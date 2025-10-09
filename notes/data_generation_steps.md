# Data Generation Steps

## Translate Indian Texts to English

* The scripts are in TimelessWords/docs/scripts directory.
* **pdf_to_long_image.py:** Converts 2 or more images into a single image. Purpose is to save the amount of calls made to OpenAI API for OCR conversion.
* **step1_rename_clean_filenames.py:** First clean the pdf names in the directory. Remove special characters, spaces and replace with underscores.
* **step2_pdfs_to_images.py:** Then break each pdf into separate images in the above directories.
* **step3_sanskrit_images_to_md.py:** Then loop over each image and send the image to OpenAI API for OCR and get text response in particular format mentioned in the file. Here its markdown but this will change to json format in the future to load the file directly into the website.

### Prompt to generate verses

* You are an expert Sanskrit philologist and translator.
* You will be given a page IMAGE of a Sanskrit manuscript (may contain multiple verses).
* Perform OCR yourself and return **only Markdown**, in the EXACT structure below for each verse.
* Extract and translate ONE Sanskrit verse (if multiple are present, treat the whole block as one verse unit) into the following JSON fields:

```json
{
  "id": "vp",
  "short": "VP",
  "title": "Vishnu Puran",
  "author": "Veda Vyas",
  "type": "Puranas",
  "date_of_origin": "Atleast 2nd century BCE.",
  "chapters": [
    {
      "number": 1,
      "title": "Chapter 1",
      "section": 1,
      "section_title": "Unknown",
      "verses": [
        {
          "number": 1,
          "ref": "1.1",
          "devanagari": "श्रोतव्यं सततं तस्मात्सर्वपापप्रणाशनम् । ब्रह्माण्डपुराणं पुण्यं सर्वानन्दप्रदायकम् ॥ १० ॥",
          "iast": "oṁ namo bhagavate vāsudevāya\njanmādy asya yataḥ sṛṣṭi-sthiti-layāḥ\nsatyasya jñānānandasya brahmaṇaḥ\nparamātmanaḥ",
          "word_by_word": [
            {
              "sanskrit": "oṁ",
              "english": "sacred syllable"
            },
            {
              "sanskrit": "namo",
              "english": "obeisance"
            },
            {
              "sanskrit": "bhagavate",
              "english": "unto the Lord"
            },
            {
              "sanskrit": "vāsudevāya",
              "english": "Vāsudeva (Kṛṣṇa)"
            }
          ],
          "translation": "Om! I bow to the blessed Lord Vāsudeva, the Supreme Self, from whom arise creation, preservation, and dissolution, who is truth, knowledge, and bliss."
        },
        {
          "number": 2,
          "ref": "1.2",
          "devanagari": "श्रोतव्यं सततं तस्मात्सर्वपापप्रणाशनम् । ब्रह्माण्डपुराणं पुण्यं सर्वानन्दप्रदायकम् ॥ १० ॥",
          "iast": "viṣṇoḥ paramaṁ rūpaṁ sattva-rūpaṁ sanātanam\nśuddhaṁ sac-cid-ānandaṁ yad brahma paramaṁ viduḥ",
          "word_by_word": [
            {
              "sanskrit": "viṣṇoḥ",
              "english": "of Viṣṇu"
            },
            {
              "sanskrit": "paramam",
              "english": "supreme"
            },
            {
              "sanskrit": "rūpam",
              "english": "form"
            }
          ],
          "translation": "The supreme form of Viṣṇu is eternal, pure existence-consciousness-bliss, composed of sattva, which the wise know as the highest Brahman."
        }
      ]
    }
  ]
}
```

### Explanation of commonly misunderstood JSON fields
* Under "chapters" array, number should be chapter number.
* Under "verses" array, number should be verse number.
* "type" field is the type of work, like Purana, Itihasa, Veda, Upanishad, etc.
* "section" field under chapters array is the canto number if any exists.
* "section_title" under chapters array is the canto title if any exists.

### Rules:
* If chapter or verse are not clearly present inside the provided text, set them to null.
* Preserve the verse line breaks in 'original_sanskrit'.
* Use standard IAST for transliteration (ā ī ū ṛ ṝ ḷ ṃ ṁ ṇ ṭ ḍ ś ṣ ñ etc.).
* 'word_by_word' should be a short list of pairs (no commentary).
* Keep it strictly valid JSON (no trailing commas, no extra keys).
* Do NOT include any top-level headers or notes; only the verse blocks with separators.
* Don't add dividers btw json objects. Output json array if asked for more than 1 item. The output should be a code block.


### Load data from JSON

* **build_library_sqlite_from_jsons.py:** This script can take a directory filled with json files and give a sqlite file with all the json data. The json files have to be in this specific format. The jsons directory contains sample json files of some Vedic texts all in this particular json format.

```json
{
  "id": "vishnu_puran",
  "short": "VP",
  "title": "Vishnu Puran",
  "author": "Veda Vyas",
  "type": "Puranas",
  "date_of_origin": "Atleast 2nd century BCE.",
  "chapters": [
    {
      "number": 1,
      "title": "Chapter 1",
      "section": 1,
      "section_title": "Unknown",
      "verses": [
        {
          "number": 1,
          "ref": "1.1",
          "devanagari": "श्रोतव्यं सततं तस्मात्सर्वपापप्रणाशनम् । ब्रह्माण्डपुराणं पुण्यं सर्वानन्दप्रदायकम् ॥ १० ॥",
          "iast": "oṁ namo bhagavate vāsudevāya\njanmādy asya yataḥ sṛṣṭi-sthiti-layāḥ\nsatyasya jñānānandasya brahmaṇaḥ\nparamātmanaḥ",
          "word_by_word": [
            {
              "sanskrit": "oṁ",
              "english": "sacred syllable"
            },
            {
              "sanskrit": "namo",
              "english": "obeisance"
            },
            {
              "sanskrit": "bhagavate",
              "english": "unto the Lord"
            },
            {
              "sanskrit": "vāsudevāya",
              "english": "Vāsudeva (Kṛṣṇa)"
            }
          ],
          "translation": "Om! I bow to the blessed Lord Vāsudeva, the Supreme Self, from whom arise creation, preservation, and dissolution, who is truth, knowledge, and bliss."
        },
        {
          "number": 2,
          "ref": "1.2",
          "devanagari": "श्रोतव्यं सततं तस्मात्सर्वपापप्रणाशनम् । ब्रह्माण्डपुराणं पुण्यं सर्वानन्दप्रदायकम् ॥ १० ॥",
          "iast": "viṣṇoḥ paramaṁ rūpaṁ sattva-rūpaṁ sanātanam\nśuddhaṁ sac-cid-ānandaṁ yad brahma paramaṁ viduḥ",
          "word_by_word": [
            {
              "sanskrit": "viṣṇoḥ",
              "english": "of Viṣṇu"
            },
            {
              "sanskrit": "paramam",
              "english": "supreme"
            },
            {
              "sanskrit": "rūpam",
              "english": "form"
            }
          ],
          "translation": "The supreme form of Viṣṇu is eternal, pure existence-consciousness-bliss, composed of sattva, which the wise know as the highest Brahman."
        }
      ]
    }
  ]
}
```

* Under "chapters" array, number should be chapter number.
* Under "verses" array, number should be verse number.
* "type" field is the type of work, like Purana, Itihasa, Veda, Upanishad, etc.
* "section" field under chapters array is the canto number if any exists.
* "section_title" under chapters array is the canto title if any exists.

