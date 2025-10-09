# Timeless Words
Collection of Vedic texts

![alt text](https://github.com/agarapatri/Timeless-Words/blob/main/extras/banner.png)
Art by: [Yuqing Sheng](x.com/merasgar)



## Demo
* https://agarapatri.github.io/Timeless-Words/
* If the website seems slow or is unresponsive, you must know that the site is running on github pages and the free tier has limitations. The best thing to do is to Fork it and host it on your own github account. 
* GitHub Pages usage: ~1 GB site size and ~100 GB/month bandwidth.
* Also if you are facing issues with Semantic search it is best to clear the cache of the site or delete the entire site data. Go to "Site Settings" -> "Delete Data".
* Semantic search or search by meaning wont work on browsers that don't support OPFS write.This feature currently works on Chromium browsers. So if you use browsers like Safari, you can't do "Search by Meaning". This also applies to mobile browsers.
* If you are in Lockdown mode on iOS or something similar, please disable Lockdown Mode for this site on your device and reload the page. You might face issues with Opera browser as well as it doesn't seem to detect Lockdown Mode on iOS.
* Check project documentation [here](https://github.com/agarapatri/Timeless-Words/tree/main/notes/project_docs.md) and [here](https://github.com/agarapatri/Timeless-Words/tree/main/notes/project_flow.md). For more info, check [notes](https://github.com/agarapatri/Timeless-Words/tree/main/notes) directory.
* This project used Web Assembly. Check browser support [here](https://github.com/agarapatri/Timeless-Words/tree/main/notes/web_assembly_support.md). Check DB Schema [here](https://github.com/agarapatri/Timeless-Words/tree/main/notes/db_schema.md).



## How to create or update local database?
* Below are steps to create or update `library.{{DB_VERSION}}.sqlite` and `library.semantic.v01.sqlite`
* Before running the script, add json files into `TimelessWords/docs/scripts/json_samples`. Then run below command. The json data is present in `TimelessWords/extras/json_samples`. If you have your own data, you must follow the same json format and put them in this directory.
* Run below command from `TimelessWords/docs/scripts` directory: 
```bash
chmod +x build_db.sh && ./build_db.sh
```
* This will create a new library sqlite db and the semantic sqlite db with the new data that is present in `scripts/json_samples`. 
* Below steps are just info. This is the only step needed to add new data to the sqlite db.
* Verify sqlite with tests. Run below command from `TimelessWords/docs/scripts` directory:
```bash
chmod +x semantic_db_tests/run_tests.sh && ./semantic_db_tests/run_tests.sh
```


## Types of Vedic Texts
* **Vedas**:
  * Ṛg
  * Yajur
  * Sāma
  * Atharva
* **Layers of Vedas**: 
  * Saṁhitā (hymns)
  * Brāhmaṇa (ritual prose)
  * Āraṇyaka (forest texts)
  * Upaniṣad (philosophy)
* **Upaniṣads**: A lot of them but chief are PROBABLY 108 according to Muktika Upanishad which is the 108th one.
* **Itihāsas** (Epics): 
  * Rāmāyaṇa
  * Mahābhārata (includes Bhagavad-Gītā)
* **Mahā-Purāṇas**: 18 Mahā-Purāṇas
* **Upa-Purāṇas**
* **Ati-Purāṇas**
* **Vedāṅgas**:
  * Śikṣā (phonetics)
  * Chandas (metre)
  * Vyākaraṇa (grammar)
  * Nirukta (etymology)
  * Jyotiṣa (astronomy/astrology)
  * Kalpa (ritual manuals)
* **Dharmaśāstra**: legal/ethical codes (e.g., Manusmṛti, Yājñavalkya Smṛti)
* **Upavedas** (applied “Vedas”): 
  * Āyurveda (medicine)
  * Dhanurveda (martial)
  * Gāndharvaveda (music/arts)
  * Sthāpatyaveda (architecture)
* **Darśanas** (6 orthodox schools): 
  * Nyāya
  * Vaiśeṣika
  * Sāṅkhya
  * Yoga
  * Pūrva-Mīmāṁsā
  * Uttara-Mīmāṁsā (Vedānta)
* **Āgamas/Tantras**: Śaiva, Vaiṣṇava (Pāñcarātra), Śākta traditions and their Saṁhitās.
* **Commentaries**: Bhāṣyas, Nibandhas, Kāvya, Nīti/Artha texts (e.g., Arthaśāstra)
* **Gitas**
* **Kalpa Sūtras** (within Vedāṅga): Śrauta, Gṛhya, Dharma (incl. Śulba Sūtras)
* **Others**



## Upcoming Features / Issues

* LLM Summarisation grounded on this sqlite data. (Not sure)
* TTS should work for full page
* Provide detailed tests in docs for testing each aspect of the site especially search
* Use an LLM only for optional answer synthesis/rag-style summaries after retrieval; and even that can be on-device (WebLLM/Llama.cpp).
* minify css & js files
* Safari deep search icon is missing
* safari slider controls UI is broken
* safari home book type filter button is not a circle
* Safari large favicon not working
* safari chapter drop down filter UI style is broken
* Optimise SQL queries
* Serif font is not applying to all text
* Font size is not applying to all text
* In menu deep search is highlighted. remove the highlight
* serve.js has hardcoded url with port 8000
