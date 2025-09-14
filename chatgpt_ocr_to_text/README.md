# Translate Indian Texts to English

* **pdf_to_long_image.py:** Converts 2 or more images into a single image. Purpose is to save the amount of calls made to OpenAI API for OCR conversion.
* **step1_rename_clean_filenames.py:** First clean the pdf names in the directory. Remove special characters, spaces and replace with underscores.
* **step2_pdfs_to_images.py:** Then break each pdf into separate images in the above directories.
* **step3_sanskrit_images_to_md.py:** Then loop over each image and send the image to OpenAI API for OCR and get text response in particular format mentioned in the file. Here its markdown but this will change to json format in the future to load the file directly into the website.
