#include <napi.h>

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <string>
#include <utility>
#include <vector>

namespace {

std::string Normalize(const std::string& input) {
  std::string output;
  output.reserve(input.size());
  bool previous_space = true;

  for (const unsigned char character : input) {
    if (character >= 128 || std::isalnum(character) != 0) {
      output.push_back(static_cast<char>(std::tolower(character)));
      previous_space = false;
    } else if (!previous_space) {
      output.push_back(' ');
      previous_space = true;
    }
  }

  if (!output.empty() && output.back() == ' ') output.pop_back();
  return output;
}

std::vector<std::string> Tokens(const std::string& normalized) {
  std::vector<std::string> tokens;
  std::size_t start = 0;
  while (start < normalized.size()) {
    const auto end = normalized.find(' ', start);
    tokens.emplace_back(normalized.substr(start, end == std::string::npos ? std::string::npos : end - start));
    if (end == std::string::npos) break;
    start = end + 1;
  }
  return tokens;
}

Napi::Object Health(const Napi::CallbackInfo& info) {
  const auto env = info.Env();
  auto result = Napi::Object::New(env);
  result.Set("ok", true);
  result.Set("engine", "words-of-yeshua-native");
  result.Set("apiVersion", 1);
  result.Set("cppStandard", "C++20");
#if defined(_M_X64) || defined(__x86_64__)
  result.Set("architecture", "x64");
#elif defined(_M_ARM64) || defined(__aarch64__)
  result.Set("architecture", "arm64");
#else
  result.Set("architecture", "unknown");
#endif
  return result;
}

Napi::Value Search(const Napi::CallbackInfo& info) {
  const auto env = info.Env();
  if (info.Length() != 2 || !info[0].IsString() || !info[1].IsArray()) {
    Napi::TypeError::New(env, "search expects a query string and an array of candidate strings.").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  const auto query = Normalize(info[0].As<Napi::String>().Utf8Value());
  const auto candidates = info[1].As<Napi::Array>();
  auto result = Napi::Array::New(env);
  if (query.empty()) {
    for (std::uint32_t index = 0; index < candidates.Length(); ++index) result.Set(index, index);
    return result;
  }

  const auto query_tokens = Tokens(query);
  std::vector<std::pair<int, std::uint32_t>> ranked;
  ranked.reserve(candidates.Length());

  for (std::uint32_t index = 0; index < candidates.Length(); ++index) {
    const auto value = candidates.Get(index);
    if (!value.IsString()) {
      Napi::TypeError::New(env, "Every search candidate must be a string.").ThrowAsJavaScriptException();
      return env.Undefined();
    }

    const auto candidate = Normalize(value.As<Napi::String>().Utf8Value());
    const auto phrase_position = candidate.find(query);
    int score = 0;

    if (phrase_position != std::string::npos) {
      score = 10000 - static_cast<int>(std::min<std::size_t>(phrase_position, 5000));
    } else {
      bool all_tokens_found = true;
      for (const auto& token : query_tokens) {
        const auto token_position = candidate.find(token);
        if (token_position == std::string::npos) {
          all_tokens_found = false;
          break;
        }
        score += 100 - static_cast<int>(std::min<std::size_t>(token_position, 99));
      }
      if (!all_tokens_found) continue;
    }

    ranked.emplace_back(score, index);
  }

  std::stable_sort(ranked.begin(), ranked.end(), [](const auto& left, const auto& right) {
    if (left.first != right.first) return left.first > right.first;
    return left.second < right.second;
  });

  for (std::uint32_t result_index = 0; result_index < ranked.size(); ++result_index) {
    result.Set(result_index, ranked[result_index].second);
  }
  return result;
}

Napi::Object Initialize(Napi::Env env, Napi::Object exports) {
  exports.Set("health", Napi::Function::New(env, Health));
  exports.Set("search", Napi::Function::New(env, Search));
  return exports;
}

}  // namespace

NODE_API_MODULE(words_of_yeshua_native, Initialize)
