import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";
import convert from "https://cdn.jsdelivr.net/npm/xml-js@1.6.11/+esm";


document.addEventListener("DOMContentLoaded", () => {

    // Global data store
    window.bookJson = null;
    let zip = null;
    const targetPath = "OEBPS/content.opf";
    const metadataDefinitions = [
        { label: "Language", field: "dc:language" },
        { label: "Author", field: "dc:creator", attributes: { "opf:role": "aut" } },
        { label: "Creator", field: "dc:creator" },
        { label: "Contributor", field: "dc:contributor" },
        { label: "Coverage", field: "dc:coverage" },
        { label: "Title", field: "dc:title" },

        // Dates
        { label: "Date", field: "dc:date" },
        { label: "Creation Date", field: "dc:date", attributes: { "opf:event": "creation" } },
        { label: "Modification Date", field: "dc:date", attributes: { "opf:event": "modification" } },
        { label: "Publication Date", field: "dc:date", attributes: { "opf:event": "publication" } },

        { label: "Description", field: "dc:description" },
        { label: "Format", field: "dc:format" },

        // Identifiers
        { label: "Amazon Identifier", field: "dc:identifier", attributes: { "opf:scheme": "AMAZON" } },
        { label: "DOI Identifier", field: "dc:identifier", attributes: { "opf:scheme": "DOI" } },
        { label: "ISBN Identifier", field: "dc:identifier", attributes: { "opf:scheme": "ISBN" } },
        { label: "ISSN Identifier", field: "dc:identifier", attributes: { "opf:scheme": "ISSN" } },
        { label: "UUID Identifier", field: "dc:identifier", attributes: { "opf:scheme": "UUID", id: "BookId" } },

        // Meta tags
        { label: "Series", field: "meta", attributes: { name: "calibre:series" }, attrValue: "content" },
        { label: "Series Index", field: "meta", attributes: { name: "calibre:series_index" }, attrValue: "content" },

        { label: "Publisher", field: "dc:publisher" },
        { label: "Relation", field: "dc:relation" },
        { label: "Rights", field: "dc:rights" },
        { label: "Source", field: "dc:source" },
        { label: "Subject", field: "dc:subject" },
        { label: "Type", field: "dc:type" }
    ];

    /**
    * Ensures that the specified field in the given object is always an array.
    * If the field does not exist, it initializes it as an empty array.
    * If the field exists but is not an array, it wraps its value in an array.
    *
    * @param {Object} md - The object containing the field to normalize.
    * @param {string} field - The name of the field to normalize.
    * @returns {Array} The normalized array value of the specified field.
    */
    function normalizeField(md, field) {
        if (!md[field]) {
            md[field] = [];
        }

        if (!Array.isArray(md[field])) {
            md[field] = [md[field]];
        }

        return md[field];
    }


    /**
    * Renders the side panel with buttons for each metadata definition.
    * Clears the existing panel content and dynamically creates a button for each entry in `metadataDefinitions`.
    * Each button, when clicked, adds the corresponding metadata entry and re-renders the metadata UI.
    *
    * @returns {void}
    */
    function renderSidePanel() {
        const panel = document.getElementById("addFieldList");
        panel.innerHTML = "";

        metadataDefinitions.forEach(def => {
            const btn = document.createElement("button");
            btn.textContent = def.label;
            btn.className = "add-field-btn";

            btn.addEventListener("click", () => {
                addMetadataEntry(def);
                renderMetadataUI();
            });

            panel.appendChild(btn);
        });
    }


    /**
    * Renders the metadata editing user interface for the current book.
    * Iterates over metadata definitions and dynamically creates editable input fields
    * for each metadata entry, including support for attribute-based filtering and value editing.
    * Also provides a remove button for each entry to allow deletion and UI refresh.
    *
    * @returns {void}
    */
    function renderMetadataUI() {
        const container = document.getElementById("metadataContainer");
        container.innerHTML = "";

        const md = window.bookJson.package.metadata;

        metadataDefinitions.forEach(def => {
            const entries = md[def.field];
            if (!entries) return;

            const list = getEntriesForDefinition(def, md);

            list.forEach((entry, index) => {
                if (def.attributes) {
                    const match = Object.entries(def.attributes).every(
                        ([k, v]) => entry._attributes?.[k] === v
                    );
                    if (!match) return;
                }

                const block = document.createElement("div");
                block.className = "meta-block";

                const label = document.createElement("label");
                label.textContent = def.label;
                block.appendChild(label);

                const input = document.createElement("input");
                input.type = "text";

                if (def.attrValue) {
                    input.value = entry._attributes?.[def.attrValue] || "";
                } else {
                    input.value = entry._text || "";
                }

                input.addEventListener("input", e => {
                    if (def.attrValue) {
                        entry._attributes[def.attrValue] = e.target.value;
                    } else {
                        entry._text = e.target.value;
                    }
                });

                block.appendChild(input);

                const removeBtn = document.createElement("button");
                removeBtn.textContent = "Remove";
                removeBtn.className = "remove-field-btn";

                removeBtn.addEventListener("click", () => {
                    removeMetadataEntry(def, entry);
                    renderMetadataUI();
                });

                block.appendChild(removeBtn);

                container.appendChild(block);
            });
        });
    }

    /**
    * Adds a metadata entry to the bookJson package metadata object.
    * Normalizes the specified metadata field, constructs a new entry with optional attributes,
    * and appends it to the corresponding metadata list. Ensures that generic entries do not
    * unintentionally match specific definitions by initializing attributes appropriately.
    *
    * @param {Object} def - Definition object for the metadata entry.
    * @param {string} def.field - The metadata field to which the entry should be added.
    * @param {Object} [def.attributes] - Optional attributes to include in the entry.
    * @param {string} [def.attrValue] - Optional attribute key to be added with an empty string value.
    */
    function addMetadataEntry(def) {
        const md = window.bookJson.package.metadata;
        const list = normalizeField(md, def.field);

        const entry = {};

        if (def.attributes) {
            entry._attributes = { ...def.attributes };
        } else {
            entry._attributes = {};
        }

        if (def.attrValue) {
            entry._attributes[def.attrValue] = "";
        } else {
            entry._text = "";
        }

        list.push(entry);
    }

    /**
    * Retrieves entries from the metadata for a given field definition, filtering by specified attributes.
    * If the definition includes attributes, only entries matching all attribute key-value pairs are returned.
    * If no attributes are specified, entries are filtered to exclude those matching any other definition's attributes for the same field.
    *
    * @param {Object} def - The field definition object, possibly containing 'field' and 'attributes' properties.
    * @param {Object} md - The metadata object containing field data.
    * @returns {Array<Object>} - An array of entries matching the definition and attribute criteria.
    */
    function getEntriesForDefinition(def, md) {
        const list = normalizeField(md, def.field);

        if (def.attributes) {
            return list.filter(entry =>
                Object.entries(def.attributes).every(
                    ([k, v]) => entry._attributes?.[k] === v
                )
            );
        }

        const otherDefs = metadataDefinitions.filter(
            d => d.field === def.field && d.attributes
        );

        return list.filter(entry => {
            return !otherDefs.some(d =>
                Object.entries(d.attributes).every(
                    ([k, v]) => entry._attributes?.[k] === v
                )
            );
        });
    }

    /**
    * Removes a specific metadata entry from the bookJson package metadata.
    * If the entry is the last one for the given field, the field is deleted from metadata.
    *
    * @param {Object} def - Definition object containing the metadata field name (def.field).
    * @param {string} entry - The metadata entry value to remove.
    */
    function removeMetadataEntry(def, entry) {
        const md = window.bookJson.package.metadata;

        if (!md[def.field]) return;

        const list = normalizeField(md, def.field);

        md[def.field] = list.filter(e => e !== entry);

        if (md[def.field].length === 0) {
            delete md[def.field];
        }
    }

    /**
    * Asynchronously loads and processes an EPUB file, extracting its content and rendering UI components.
    * @param {File|Blob} file - The EPUB file to be loaded (as a File or Blob object).
    * @returns {Promise<void>} Resolves when the EPUB is loaded and UI is updated.
    *
    * Loads the EPUB archive using JSZip, checks for the presence of the 'content.opf' file in the expected location,
    * parses its XML content into a JSON object, updates the global bookJson, and triggers rendering of the side panel
    * and metadata UI. Displays the editor section upon successful load.
    * Alerts the user if the required file is not found.
    */
    async function loadEpub(file) {
        zip = await JSZip.loadAsync(file);

        if (!zip.files[targetPath]) {
            alert("content.opf not found in OEBPS folder");
            return;
        }

        const xmlText = await zip.files[targetPath].async("text");
        window.bookJson = xmlToJson(xmlText);
        if(window.bookJson.package._attributes.version ==! '2.0') {
            alert("Books is not version 2");
            return;
        }
        window.fileName = file.name;
        renderSidePanel();
        renderMetadataUI();
        document.getElementById("editorSection").style.display = "block";

    }

    /**
    * Converts an XML string to a JSON object.
    * @param {string} xmlText - The XML string to be converted.
    * @returns {Object} The resulting JSON object parsed from the XML input.
    */
    function xmlToJson(xmlText) {
        return JSON.parse(
            convert.xml2json(xmlText, { compact: true, spaces: 2 })
        );
    }

    /**
    * Converts a JSON object to its XML representation using the convert.json2xml utility.
    * @param {Object} jsonObj - The JSON object to be converted to XML.
    * @returns {string} The XML string representation of the input JSON object.
    */
    function jsonToXml(jsonObj) {
        return convert.json2xml(
            JSON.stringify(jsonObj),
            { compact: true, spaces: 2 }
        );
    }

    /**
    * Saves the modified EPUB file by converting the current book JSON to XML, updating the EPUB archive,
    * and triggering a download of the new EPUB file. Alerts the user if no EPUB is loaded.
    * 
    * @async
    * @returns {Promise<void>} Resolves when the EPUB file has been generated and the download initiated.
    */
    async function saveEpub() {
        if (!zip || !window.bookJson) {
            alert("Upload an EPUB first");
            return;
        }

        const newXml = jsonToXml(window.bookJson);
        zip.file(targetPath, newXml);

        const newEpubBlob = await zip.generateAsync({ type: "blob" });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(newEpubBlob);
        a.download = window.fileName;
        a.click();
    }

    document.getElementById("zipInput").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) loadEpub(file);
    });

    document.getElementById("saveBtn").addEventListener("click", saveEpub);

});
