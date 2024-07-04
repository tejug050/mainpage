#!/bin/bash

# Directory containing the files
FILES_DIR="/var/www/html/upload"

# Convert document files to PDF
for file in "$FILES_DIR"/*.doc "$FILES_DIR"/*.docx; do
    if [ -f "$file" ]; then
        # Convert using libreoffice
        libreoffice --headless --convert-to pdf --outdir "$FILES_DIR" "$file"

        # Check if conversion was successful
        if [ $? -eq 0 ]; then
            # Conversion successful, now remove the original document file
            rm "$file"
        else
            echo "Conversion of $file to PDF failed."
        fi
    fi
done
