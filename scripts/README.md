# HOW TO RUN
* Before running the script, add json files into TimelessWords/docs/scripts/json_samples. Then run below command. The samples are present in TimelessWords/notes_n_extras/json_samples.
* RUN from TimelessWords/docs/scripts: 
```bash
chmod +x build_and_clean.sh && ./build_and_clean.sh
```
* This will create a new library sqlite db and the semantic sqlite db with the new data that is present in scripts/json_samples. 
* Below steps are just info. This is the only step needed to add new data to the sqlite db.

---

# Translate Indian Texts to English

* **json_to_sqlite_cli.py:** This script can take a directory filled with json files and give a sqlite file with all the json data. The json files have to be in this specific format. The jsons directory contains sample json files of some Vedic texts all in this particular json format.

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

* Under "chapters" array, number should be chapter number.
* Under "verses" array, number should be verse number.
* "type" field is the type of work, like Purana, Itihasa, Veda, Upanishad, etc.
* "section" field under chapters array is the canto number if any exists.
* "section_title" under chapters array is the canto title if any exists.


## Helper commands
* In terminal, to cut PDFs into multiple files based on page length
```bash
pdfcpu split -m span input_file.pdf output_dir/ page_count
```

# How to run these scripts
* Almost all of them require these steps and better to do it in a separate virtual env within the scripts dir
```bash
cd /TimelessWords/docs/scripts/
python3 -m venv venv
source venv/bin/activate
pip install numpy
pip install onnxruntime
pip install tokenizers
pip install onnx
pip install onnxsim # This can fail. check below
python3 encode_semantic.py/quantize_dynamic.pt/... etc
deactivate
```

* To install onnxsim
```bash
brew install pyenv
brew install pyenv pyenv-virtualenv
pyenv virtualenv 3.11.9 onnxsim311
pyenv activate onnxsim311
pip install onnx onnxsim # This fails. Seek help.
python -m onnxsim assets/data/semantic/onnx_model/model.onnx assets/data/semantic/onnx_model/model_simplified.onnx
```

* Result of the installs

┏━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━┓
┃                        ┃ Original Model ┃ Simplified Model ┃
┡━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━┩
│ Add                    │ 2              │ 2                │
│ Attention              │ 6              │ 6                │
│ BiasGelu               │ 6              │ 6                │
│ Cast                   │ 1              │ 1                │
│ Constant               │ 84             │ 81               │
│ Gather                 │ 4              │ 4                │
│ LayerNormalization     │ 1              │ 1                │
│ MatMul                 │ 18             │ 18               │
│ ReduceSum              │ 1              │ 1                │
│ Shape                  │ 1              │ 1                │
│ SkipLayerNormalization │ 12             │ 12               │
│ Slice                  │ 1              │ 1                │
│ Unsqueeze              │ 1              │ 1                │
│ Model Size             │ 86.1MiB        │ 86.1MiB          │
└────────────────────────┴────────────────┴──────────────────┘

## Pipeline order and commands

1. **Encode corpus to embeddings**
   Generates embeddings with the chosen model. Use FP32 for quality or INT8 for speed.

```bash
python encode_semantic.py \
  --model models/work/model_int8.onnx \
  --input data/corpus.tsv \
  --text-col text \
  --out embeddings/embeddings.npy \
  --id-out embeddings/ids.npy
```

2. **Build semantic manifest**
    Creates metadata JSON for your pack.

```bash
python build_semantic_manifest.py \
  --name my_pack \
  --model-path models/work/model_int8.onnx \
  --dim 384 \
  --embedding-file embeddings/embeddings.npy \
  --ids-file embeddings/ids.npy \
  --out packs/my_pack_manifest.json
```

3. **Build semantic pack**
    Bundles model + manifest + resources.

```bash
python build_semantic_pack.py \
  --manifest packs/my_pack_manifest.json \
  --out packs/my_pack.tar.gz
```
