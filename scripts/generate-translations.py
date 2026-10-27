"""One-time offline draft generator; review generated copy before publishing.

Usage (with Argos Translate installed):
  python3 scripts/generate-translations.py es /path/to/en_es.argosmodel
The Argos model and package directories can live outside the repository.
"""

import json
import sys
from pathlib import Path

import argostranslate.package
import argostranslate.translate


ROOT = Path(__file__).resolve().parents[1]
LANG_CODES = {"id": "id", "es": "es", "pt-BR": "pb", "ru": "ru", "fr": "fr", "vi": "vi",
              "zh-CN": "zh", "ja": "ja", "de": "de", "it": "it", "ar": "ar",
              "hi": "hi", "ko": "ko", "tr": "tr", "th": "th", "pl": "pl", "nl": "nl"}


def main():
    locale, model_path = sys.argv[1:3]
    target = LANG_CODES[locale]
    languages = argostranslate.translate.get_installed_languages()
    if target not in [language.code for language in languages]:
        argostranslate.package.install_from_path(model_path)
        languages = argostranslate.translate.get_installed_languages()
    english = next(language for language in languages if language.code == "en")
    destination = next(language for language in languages if language.code == target)
    translator = english.get_translation(destination)
    cache = {}

    def translate(value):
        if not value:
            return value
        if value not in cache:
            cache[value] = translator.translate(value).strip() or value
        return cache[value]

    source_messages = json.loads((ROOT / "src/i18n/messages.en.json").read_text())
    messages_path = ROOT / f"src/i18n/messages.{locale}.json"
    messages = json.loads(messages_path.read_text()) if messages_path.exists() else {}
    for index, source in enumerate(source_messages):
        if source not in messages:
            messages[source] = translate(source)
        if index % 50 == 0:
            print(f"{locale}: UI {index}/{len(source_messages)}", flush=True)
    messages_path.write_text(
        json.dumps(messages, ensure_ascii=False, indent=2) + "\n"
    )

    articles_path = ROOT / f"src/content/articles.{locale}.json"
    if articles_path.exists():
        print(f"{locale}: existing article translations kept", flush=True)
        return
    articles = json.loads((ROOT / "src/content/articles.json").read_text())
    translated = []
    for index, article in enumerate(articles):
        copy = {**article}
        for field in ("title", "description", "intro", "toolLabel"):
            copy[field] = translate(article[field])
        copy["sections"] = [
            {"heading": translate(section["heading"]),
             "paragraphs": [translate(paragraph) for paragraph in section["paragraphs"]]}
            for section in article["sections"]
        ]
        copy["faq"] = [
            {"question": translate(item["question"]), "answer": translate(item["answer"])}
            for item in article["faq"]
        ]
        copy["sources"] = [
            {**source, "label": translate(source["label"])} for source in article["sources"]
        ]
        translated.append(copy)
        print(f"{locale}: articles {index + 1}/{len(articles)}", flush=True)
    articles_path.write_text(
        json.dumps(translated, ensure_ascii=False, indent=2) + "\n"
    )


if __name__ == "__main__":
    main()
