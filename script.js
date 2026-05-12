import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";
import convert from "https://cdn.jsdelivr.net/npm/xml-js@1.6.11/+esm";

document.addEventListener("DOMContentLoaded", () => {
    window.bookJson = null;
    window.fileName = "";
    window.epubVersion = "unknown";

    let zip = null;
    let packagePath = null;
    let metadataDefinitions = [];

    const fallbackPackagePaths = [
        "OEBPS/content.opf",
        "OPS/content.opf",
        "content.opf"
    ];

    const commonDcDefinitions = [
        { label: "Language", field: "dc:language", required: true, maxOccurs: 1 },
        { label: "Title", field: "dc:title", required: true, ensureIdPrefix: "title" },
        { label: "Creator", field: "dc:creator", ensureIdPrefix: "creator" },
        { label: "Contributor", field: "dc:contributor", ensureIdPrefix: "contributor" },
        { label: "Publisher", field: "dc:publisher", maxOccurs: 1 },
        { label: "Rights", field: "dc:rights", maxOccurs: 1 },
        { label: "Publication Date", field: "dc:date", maxOccurs: 1 },
        { label: "Description", field: "dc:description", maxOccurs: 1 },
        { label: "Subject", field: "dc:subject", ensureIdPrefix: "subject" },
        { label: "Source", field: "dc:source", ensureIdPrefix: "source", maxOccurs: 1 },
        { label: "Type", field: "dc:type", maxOccurs: 1 },
        { label: "Coverage", field: "dc:coverage", maxOccurs: 1 },
        { label: "Format", field: "dc:format", maxOccurs: 1 },
        { label: "Relation", field: "dc:relation", maxOccurs: 1 },
        { label: "Identifier", field: "dc:identifier", ensureIdPrefix: "id" }
    ];

    const epub2Definitions = [
        { label: "Author", field: "dc:creator", attributes: { "opf:role": "aut" } },
        { label: "Creation Date", field: "dc:date", attributes: { "opf:event": "creation" }, maxOccurs: 1 },
        { label: "Modification Date", field: "dc:date", attributes: { "opf:event": "modification" }, maxOccurs: 1 },
        { label: "Amazon Identifier", field: "dc:identifier", attributes: { "opf:scheme": "AMAZON" } },
        { label: "DOI Identifier", field: "dc:identifier", attributes: { "opf:scheme": "DOI" } },
        { label: "ISBN Identifier", field: "dc:identifier", attributes: { "opf:scheme": "ISBN" } },
        { label: "ISSN Identifier", field: "dc:identifier", attributes: { "opf:scheme": "ISSN" } },
        { label: "UUID Identifier", field: "dc:identifier", attributes: { "opf:scheme": "UUID", id: "BookId" }, maxOccurs: 1 },
        { label: "Series", field: "meta", attributes: { name: "calibre:series" }, attrValue: "content", maxOccurs: 1 },
        { label: "Series Index", field: "meta", attributes: { name: "calibre:series_index" }, attrValue: "content", maxOccurs: 1 }
    ];

    const epub3Definitions = [
        {
            label: "Modified Date",
            field: "meta",
            attributes: { property: "dcterms:modified" },
            defaultText: () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
            required: true,
            maxOccurs: 1
        },
        {
            label: "Series / Collection",
            field: "meta",
            attributes: { property: "belongs-to-collection" },
            ensureIdPrefix: "collection"
        },
        {
            label: "Collection Position",
            field: "meta",
            attributes: { property: "group-position" },
            refinesTarget: {
                field: "meta",
                attributes: { property: "belongs-to-collection" },
                idPrefix: "collection"
            }
        },
        {
            label: "Collection Type",
            field: "meta",
            attributes: { property: "collection-type" },
            defaultText: "series",
            refinesTarget: {
                field: "meta",
                attributes: { property: "belongs-to-collection" },
                idPrefix: "collection"
            }
        },
        {
            label: "Creator Role",
            field: "meta",
            attributes: { property: "role" },
            createAttributes: { property: "role", scheme: "marc:relators" },
            defaultText: "aut",
            refinesTarget: { field: "dc:creator", idPrefix: "creator" }
        },
        {
            label: "Creator Sort Name",
            field: "meta",
            attributes: { property: "file-as" },
            refinesTarget: { field: "dc:creator", idPrefix: "creator" }
        },
        {
            label: "Creator Display Order",
            field: "meta",
            attributes: { property: "display-seq" },
            defaultText: "1",
            refinesTarget: { field: "dc:creator", idPrefix: "creator" }
        },
        {
            label: "Title Type",
            field: "meta",
            attributes: { property: "title-type" },
            defaultText: "main",
            refinesTarget: { field: "dc:title", idPrefix: "title" }
        },
        {
            label: "Subject Authority",
            field: "meta",
            attributes: { property: "authority" },
            refinesTarget: { field: "dc:subject", idPrefix: "subject" }
        },
        {
            label: "Subject Term",
            field: "meta",
            attributes: { property: "term" },
            refinesTarget: { field: "dc:subject", idPrefix: "subject" }
        },
        {
            label: "Identifier Type",
            field: "meta",
            attributes: { property: "identifier-type" },
            createAttributes: { property: "identifier-type", scheme: "onix:codelist5" },
            defaultText: "15",
            refinesTarget: { field: "dc:identifier", idPrefix: "id" }
        }
    ];

    const roleLabels = {
        aut: "Author",
        ill: "Illustrator",
        trl: "Translator",
        edt: "Editor",
        art: "Artist",
        pbl: "Publisher",
        nrt: "Narrator",
        ctb: "Contributor",
        cre: "Creator"
    };

    const identifierTypeOptions = [
        { value: "15", label: "ISBN-13" },
        { value: "02", label: "ISBN-10" },
        { value: "03", label: "GTIN-13" },
        { value: "06", label: "DOI" },
        { value: "01", label: "Proprietary" }
    ];

    const epub3CreatorRoleDefinitions = [
        { label: "Illustrator", field: "dc:creator", ensureIdPrefix: "creator", defaultCreatorRole: "ill", addOnly: true },
        { label: "Translator", field: "dc:creator", ensureIdPrefix: "creator", defaultCreatorRole: "trl", addOnly: true },
        { label: "Editor", field: "dc:creator", ensureIdPrefix: "creator", defaultCreatorRole: "edt", addOnly: true },
        { label: "Artist", field: "dc:creator", ensureIdPrefix: "creator", defaultCreatorRole: "art", addOnly: true },
        { label: "Narrator", field: "dc:creator", ensureIdPrefix: "creator", defaultCreatorRole: "nrt", addOnly: true }
    ];

    function getDefinitionsForVersion(version) {
        if (version.startsWith("3")) {
            const epub3DcDefinitions = commonDcDefinitions.map(def => {
                if (def.field !== "dc:creator") return def;

                return {
                    ...def,
                    label: "Author",
                    defaultCreatorRole: "aut"
                };
            });

            return [
                ...epub3DcDefinitions,
                ...epub3CreatorRoleDefinitions,
                ...epub3Definitions
            ];
        }

        return [
            ...commonDcDefinitions,
            ...epub2Definitions
        ];
    }

    function normalizeField(md, field) {
        if (!md[field]) {
            md[field] = [];
        }

        if (!Array.isArray(md[field])) {
            md[field] = [md[field]];
        }

        return md[field];
    }

    function asArray(value) {
        if (!value) return [];
        return Array.isArray(value) ? value : [value];
    }

    function getPackage() {
        return window.bookJson?.package || null;
    }

    function isEpub3() {
        return window.epubVersion.startsWith("3");
    }

    function getMetadata() {
        const pkg = getPackage();
        if (!pkg) return null;

        if (!pkg.metadata) {
            pkg.metadata = { _attributes: {} };
        }

        if (!pkg.metadata._attributes) {
            pkg.metadata._attributes = {};
        }

        return pkg.metadata;
    }

    function ensureMetadataNamespaces() {
        const md = getMetadata();
        if (!md) return;

        md._attributes ||= {};
        md._attributes["xmlns:dc"] ||= "http://purl.org/dc/elements/1.1/";
    }

    function hasMatchingAttributes(entry, attributes = {}) {
        return Object.entries(attributes).every(
            ([key, value]) => entry._attributes?.[key] === value
        );
    }

    function getEntryText(entry) {
        return entry?._text || "";
    }

    function getEntryDisplayName(entry) {
        if (!entry) return "";
        return getEntryText(entry) || entry._attributes?.id || entry._attributes?.property || entry._attributes?.name || "";
    }

    function findEntryById(id) {
        const md = getMetadata();
        if (!md) return null;

        for (const [field, value] of Object.entries(md)) {
            if (field === "_attributes") continue;
            const found = asArray(value).find(entry => entry._attributes?.id === id);
            if (found) {
                return found;
            }
        }

        return null;
    }

    function collectIds(obj, ids = []) {
        if (!obj || typeof obj !== "object") return ids;

        if (obj._attributes?.id) {
            ids.push(obj._attributes.id);
        }

        Object.values(obj).forEach(value => {
            if (Array.isArray(value)) {
                value.forEach(item => collectIds(item, ids));
            } else if (value && typeof value === "object") {
                collectIds(value, ids);
            }
        });

        return ids;
    }

    function generateUniqueId(prefix) {
        const existing = new Set(collectIds(window.bookJson));
        let index = 1;
        let id = prefix;

        while (existing.has(id)) {
            id = `${prefix}${String(index).padStart(2, "0")}`;
            index += 1;
        }

        return id;
    }

    function findOrCreateRefinesTarget(target) {
        const md = getMetadata();
        const entries = normalizeField(md, target.field);
        let entry = entries.find(candidate => hasMatchingAttributes(candidate, target.attributes));

        if (!entry) {
            entry = {
                _attributes: { ...(target.attributes || {}) },
                _text: ""
            };
            entries.push(entry);
        }

        entry._attributes ||= {};

        if (!entry._attributes.id) {
            entry._attributes.id = generateUniqueId(target.idPrefix || "meta");
        }

        return entry;
    }

    function ensureEntryId(entry, prefix) {
        entry._attributes ||= {};

        if (!entry._attributes.id) {
            entry._attributes.id = generateUniqueId(prefix);
        }

        return entry._attributes.id;
    }

    function getMetaRefinement(targetEntry, property) {
        const md = getMetadata();
        const targetId = targetEntry?._attributes?.id;
        if (!md || !targetId) return null;

        return asArray(md.meta).find(entry =>
            entry._attributes?.property === property &&
            entry._attributes?.refines === `#${targetId}`
        ) || null;
    }

    function findOrCreateMetaRefinement(targetEntry, property, options = {}) {
        const md = getMetadata();
        const targetId = ensureEntryId(targetEntry, options.idPrefix || "target");
        const list = normalizeField(md, "meta");
        let refinement = list.find(entry =>
            entry._attributes?.property === property &&
            entry._attributes?.refines === `#${targetId}`
        );

        if (!refinement) {
            refinement = {
                _attributes: {
                    property,
                    refines: `#${targetId}`,
                    ...(options.attributes || {})
                },
                _text: options.defaultText || ""
            };
            list.push(refinement);
        }

        return refinement;
    }

    function removeRefinementsForEntry(entry) {
        const md = getMetadata();
        const targetId = entry?._attributes?.id;
        if (!md?.meta || !targetId) return;

        const list = normalizeField(md, "meta");
        md.meta = list.filter(metaEntry => metaEntry._attributes?.refines !== `#${targetId}`);

        if (md.meta.length === 0) {
            delete md.meta;
        }
    }

    function syncCreatorDisplaySequences() {
        if (!isEpub3()) return;

        const md = getMetadata();
        const creators = asArray(md?.["dc:creator"]);

        creators.forEach((creator, index) => {
            const displaySeq = findOrCreateMetaRefinement(creator, "display-seq", {
                idPrefix: "creator",
                defaultText: String(index + 1)
            });
            displaySeq._text = String(index + 1);
        });
    }

    function getRefinesLabel(entry) {
        const refines = entry._attributes?.refines;
        if (!refines?.startsWith("#")) return "";

        const target = findEntryById(refines.slice(1));
        const targetName = getEntryDisplayName(target);

        return targetName ? ` -> ${targetName}` : ` -> ${refines}`;
    }

    function getFriendlyValue(entry) {
        if (entry._attributes?.property === "role") {
            const role = getEntryText(entry).trim();
            return roleLabels[role] ? ` (${roleLabels[role]})` : "";
        }

        return "";
    }

    function renderBookInfo() {
        const info = document.getElementById("bookInfo");

        info.innerHTML = "";

        const version = document.createElement("span");
        version.className = "info-pill";
        version.textContent = `EPUB ${window.epubVersion}`;

        info.append(version);
    }

    function renderSidePanel() {
        const panel = document.getElementById("addFieldList");
        panel.innerHTML = "";

        metadataDefinitions.forEach(def => {
            if (shouldHideDefinitionButton(def)) return;

            const btn = document.createElement("button");
            btn.textContent = def.label;
            btn.className = def.legacy ? "add-field-btn legacy-add-field" : "add-field-btn";

            if (isDefinitionAtMax(def)) {
                btn.disabled = true;
                btn.title = `${def.label} is already present.`;
            }

            btn.addEventListener("click", () => {
                addMetadataEntry(def);
                renderMetadataUI();
            });

            panel.appendChild(btn);
        });
    }

    function shouldHideDefinitionButton(def) {
        return isEpub3() &&
            def.field === "meta" &&
            [
                "role",
                "file-as",
                "display-seq",
                "group-position",
                "collection-type",
                "title-type",
                "authority",
                "term",
                "identifier-type"
            ].includes(def.attributes?.property);
    }

    function isDefinitionAtMax(def) {
        if (!def.maxOccurs) return false;

        const md = getMetadata();
        if (!md?.[def.field]) return false;

        return getEntriesForDefinition(def, md).length >= def.maxOccurs;
    }

    function renderMetadataUI() {
        const container = document.getElementById("metadataContainer");
        container.innerHTML = "";

        const md = getMetadata();
        if (!md) return;

        renderBookInfo();
        syncCreatorDisplaySequences();
        renderValidationPanel();
        renderSidePanel();

        metadataDefinitions.forEach(def => {
            if (!md[def.field]) return;
            if (def.addOnly) return;

            if (isEpub3() && def.field === "dc:creator") {
                renderCreatorGroups(container, md);
                return;
            }

            if (isEpub3() && def.field === "dc:title") {
                renderTitleGroups(container, md);
                return;
            }

            if (isEpub3() && def.field === "dc:subject") {
                renderSubjectGroups(container, md);
                return;
            }

            if (isEpub3() && def.field === "dc:identifier") {
                renderIdentifierGroups(container, md);
                return;
            }

            if (isEpub3() && def.field === "meta" && def.attributes?.property === "belongs-to-collection") {
                renderCollectionGroups(container, md);
                return;
            }

            if (shouldRenderAsGroupedRefinement(def)) {
                return;
            }

            const list = getEntriesForDefinition(def, md);

            list.forEach(entry => {
                const block = document.createElement("div");
                block.className = def.legacy ? "meta-block legacy-meta-block" : "meta-block";

                const label = document.createElement("label");
                label.textContent = `${def.label}${getRefinesLabel(entry)}${getFriendlyValue(entry)}`;
                block.appendChild(label);

                renderEntryInputs(block, def, entry);

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

    function shouldRenderAsGroupedRefinement(def) {
        return isEpub3() &&
            def.field === "meta" &&
            [
                "role",
                "file-as",
                "display-seq",
                "group-position",
                "collection-type",
                "title-type",
                "authority",
                "term",
                "identifier-type"
            ].includes(def.attributes?.property);
    }

    function renderTitleGroups(container, md) {
        const titles = asArray(md["dc:title"]);

        titles.forEach(title => {
            ensureEntryId(title, "title");

            const block = document.createElement("div");
            block.className = "meta-block title-meta-block";

            const label = document.createElement("label");
            label.textContent = "Title";
            block.appendChild(label);

            const titleInput = document.createElement("input");
            titleInput.type = "text";
            titleInput.value = title._text || "";
            titleInput.addEventListener("input", event => {
                title._text = event.target.value;
                renderValidationPanel();
            });
            block.appendChild(titleInput);

            appendRefinementSubfield(block, "Title Type", title, "title-type", {
                idPrefix: "title",
                allowEmpty: true,
                options: [
                    { value: "main", label: "Main" },
                    { value: "subtitle", label: "Subtitle" },
                    { value: "short", label: "Short" },
                    { value: "collection", label: "Collection" },
                    { value: "edition", label: "Edition" },
                    { value: "expanded", label: "Expanded" }
                ]
            });

            appendIdHint(block, title);
            appendRemoveButton(block, () => {
                removeRefinementsForEntry(title);
                removeMetadataEntry({ field: "dc:title" }, title);
                renderMetadataUI();
            });

            container.appendChild(block);
        });
    }

    function renderSubjectGroups(container, md) {
        const subjects = asArray(md["dc:subject"]);

        subjects.forEach(subject => {
            ensureEntryId(subject, "subject");

            const block = document.createElement("div");
            block.className = "meta-block subject-meta-block";

            const label = document.createElement("label");
            label.textContent = "Subject";
            block.appendChild(label);

            const subjectInput = document.createElement("input");
            subjectInput.type = "text";
            subjectInput.value = subject._text || "";
            subjectInput.addEventListener("input", event => {
                subject._text = event.target.value;
                renderValidationPanel();
            });
            block.appendChild(subjectInput);

            appendRefinementSubfield(block, "Authority", subject, "authority", {
                idPrefix: "subject"
            });
            appendRefinementSubfield(block, "Term", subject, "term", {
                idPrefix: "subject"
            });

            appendIdHint(block, subject);
            appendRemoveButton(block, () => {
                removeRefinementsForEntry(subject);
                removeMetadataEntry({ field: "dc:subject" }, subject);
                renderMetadataUI();
            });

            container.appendChild(block);
        });
    }

    function renderIdentifierGroups(container, md) {
        const identifiers = asArray(md["dc:identifier"]);

        identifiers.forEach(identifier => {
            ensureEntryId(identifier, "id");

            const block = document.createElement("div");
            block.className = "meta-block identifier-meta-block";

            const label = document.createElement("label");
            label.textContent = "Identifier";
            block.appendChild(label);

            const identifierInput = document.createElement("input");
            identifierInput.type = "text";
            identifierInput.value = identifier._text || "";
            identifierInput.addEventListener("input", event => {
                identifier._text = event.target.value;
                renderValidationPanel();
            });
            block.appendChild(identifierInput);

            appendRefinementSubfield(block, "Identifier Type", identifier, "identifier-type", {
                idPrefix: "id",
                attributes: { scheme: "onix:codelist5" },
                allowEmpty: true,
                options: identifierTypeOptions
            });

            appendIdHint(block, identifier);
            appendRemoveButton(block, () => {
                removeRefinementsForEntry(identifier);
                removeMetadataEntry({ field: "dc:identifier" }, identifier);
                renderMetadataUI();
            });

            container.appendChild(block);
        });
    }

    function renderCollectionGroups(container, md) {
        const collections = asArray(md.meta).filter(entry =>
            entry._attributes?.property === "belongs-to-collection" &&
            !entry._attributes?.refines
        );

        collections.forEach(collection => {
            ensureEntryId(collection, "collection");

            const block = document.createElement("div");
            block.className = "meta-block collection-meta-block";

            const label = document.createElement("label");
            label.textContent = "Series / Collection";
            block.appendChild(label);

            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.value = collection._text || "";
            nameInput.addEventListener("input", event => {
                collection._text = event.target.value;
                renderValidationPanel();
            });
            block.appendChild(nameInput);

            appendRefinementSubfield(block, "Collection Position", collection, "group-position", {
                idPrefix: "collection"
            });
            appendRefinementSubfield(block, "Collection Type", collection, "collection-type", {
                idPrefix: "collection",
                options: [
                    { value: "series", label: "Series" },
                    { value: "set", label: "Set" }
                ]
            });

            appendIdHint(block, collection);
            appendRemoveButton(block, () => {
                removeRefinementsForEntry(collection);
                removeMetadataEntry({ field: "meta" }, collection);
                renderMetadataUI();
            });

            container.appendChild(block);
        });
    }

    function renderCreatorGroups(container, md) {
        const creators = asArray(md["dc:creator"]);

        creators.forEach((creator, index) => {
            ensureEntryId(creator, "creator");

            const role = getMetaRefinement(creator, "role");
            const roleCode = getEntryText(role).trim();
            const labelText = roleLabels[roleCode] || "Creator";

            const block = document.createElement("div");
            block.className = "meta-block creator-meta-block";

            const label = document.createElement("label");
            label.textContent = labelText;
            block.appendChild(label);

            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.value = creator._text || "";
            nameInput.addEventListener("input", event => {
                creator._text = event.target.value;
                renderValidationPanel();
            });
            block.appendChild(nameInput);

            appendRefinementSubfield(block, "File As", creator, "file-as");

            appendIdHint(block, creator);

            const buttonRow = document.createElement("div");
            buttonRow.className = "meta-button-row";

            const upBtn = document.createElement("button");
            upBtn.textContent = "Move Up";
            upBtn.className = "secondary-field-btn";
            upBtn.disabled = index === 0;
            upBtn.addEventListener("click", () => {
                moveMetadataEntry("dc:creator", index, index - 1);
                renderMetadataUI();
            });

            const downBtn = document.createElement("button");
            downBtn.textContent = "Move Down";
            downBtn.className = "secondary-field-btn";
            downBtn.disabled = index === creators.length - 1;
            downBtn.addEventListener("click", () => {
                moveMetadataEntry("dc:creator", index, index + 1);
                renderMetadataUI();
            });

            const removeBtn = document.createElement("button");
            removeBtn.textContent = "Remove";
            removeBtn.className = "remove-field-btn";
            removeBtn.addEventListener("click", () => {
                removeRefinementsForEntry(creator);
                removeMetadataEntry({ field: "dc:creator" }, creator);
                renderMetadataUI();
            });

            buttonRow.append(upBtn, downBtn, removeBtn);
            block.appendChild(buttonRow);

            container.appendChild(block);
        });
    }

    function appendIdHint(block, entry) {
        const idHint = document.createElement("span");
        idHint.className = "field-hint";
        idHint.textContent = `Id Attribute: ${entry._attributes.id}`;
        block.appendChild(idHint);
    }

    function appendRemoveButton(block, onClick) {
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.className = "remove-field-btn";
        removeBtn.addEventListener("click", onClick);
        block.appendChild(removeBtn);
    }

    function appendSubfield(block, labelText, entry, valueKey, afterInput) {
        const fieldLabel = document.createElement("span");
        fieldLabel.className = "field-hint";
        fieldLabel.textContent = labelText;
        block.appendChild(fieldLabel);

        const input = document.createElement("input");
        input.type = "text";
        input.value = entry[valueKey] || "";
        input.addEventListener("input", event => {
            entry[valueKey] = event.target.value;
            renderValidationPanel();
        });
        input.addEventListener("change", () => {
            if (afterInput) afterInput();
        });
        block.appendChild(input);
    }

    function appendRefinementSubfield(block, labelText, targetEntry, property, options = {}) {
        const fieldLabel = document.createElement("span");
        fieldLabel.className = "field-hint";
        fieldLabel.textContent = labelText;
        block.appendChild(fieldLabel);

        const refinement = getMetaRefinement(targetEntry, property);
        const currentValue = refinement?._text || "";

        if (options.options) {
            appendRefinementSelect(block, targetEntry, property, currentValue, options);
            return;
        }

        const input = document.createElement("input");
        input.type = "text";
        input.value = currentValue;

        input.addEventListener("input", event => {
            const value = event.target.value;
            let current = getMetaRefinement(targetEntry, property);

            if (!value.trim() && current) {
                removeMetadataEntry({ field: "meta" }, current);
                renderValidationPanel();
                return;
            }

            if (!current && value.trim()) {
                current = findOrCreateMetaRefinement(targetEntry, property, {
                    idPrefix: options.idPrefix || "creator",
                    attributes: options.attributes
                });
            }

            if (current) {
                current._text = value;
            }

            renderValidationPanel();
        });

        input.addEventListener("change", () => {
            if (options.afterChange) options.afterChange();
        });

        if (options.placeholder) {
            input.placeholder = options.placeholder;
        }

        block.appendChild(input);
    }

    function appendRefinementSelect(block, targetEntry, property, currentValue, options = {}) {
        const select = document.createElement("select");
        const values = new Set(options.options.map(option => option.value));

        if (options.allowEmpty) {
            const emptyOption = document.createElement("option");
            emptyOption.value = "";
            emptyOption.textContent = "";
            select.appendChild(emptyOption);
        }

        if (currentValue && !values.has(currentValue)) {
            const customOption = document.createElement("option");
            customOption.value = currentValue;
            customOption.textContent = currentValue;
            select.appendChild(customOption);
        }

        options.options.forEach(option => {
            const optionElement = document.createElement("option");
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            select.appendChild(optionElement);
        });

        select.value = currentValue || options.options[0]?.value || "";
        if (options.allowEmpty && !currentValue) {
            select.value = "";
        }

        select.addEventListener("change", event => {
            const value = event.target.value;
            let current = getMetaRefinement(targetEntry, property);

            if (!value && current) {
                removeMetadataEntry({ field: "meta" }, current);
                renderValidationPanel();
                return;
            }

            if (!current) {
                current = findOrCreateMetaRefinement(targetEntry, property, {
                    idPrefix: options.idPrefix || "creator",
                    attributes: options.attributes
                });
            }

            current._text = value;
            renderValidationPanel();
        });

        if (!options.allowEmpty && !currentValue && select.value) {
            const current = findOrCreateMetaRefinement(targetEntry, property, {
                idPrefix: options.idPrefix || "creator",
                attributes: options.attributes
            });
            current._text = select.value;
        }

        block.appendChild(select);
    }

    function renderEntryInputs(block, def, entry) {
        if (def.editors) {
            entry._attributes ||= {};

            def.editors.forEach(editor => {
                const fieldLabel = document.createElement("span");
                fieldLabel.className = "field-hint";
                fieldLabel.textContent = editor.label;
                block.appendChild(fieldLabel);

                const input = document.createElement("input");
                input.type = "text";
                input.value = editor.text ? entry._text || "" : entry._attributes[editor.attr] || "";

                input.addEventListener("input", event => {
                    if (editor.text) {
                        entry._text = event.target.value;
                    } else {
                        entry._attributes[editor.attr] = event.target.value;
                    }

                    renderValidationPanel();
                });

                block.appendChild(input);
            });

            return;
        }

        const input = document.createElement("input");
        input.type = "text";

        if (def.attrValue) {
            entry._attributes ||= {};
            input.value = entry._attributes[def.attrValue] || "";
        } else {
            input.value = entry._text || "";
        }

        input.addEventListener("input", event => {
            if (def.attrValue) {
                entry._attributes ||= {};
                entry._attributes[def.attrValue] = event.target.value;
            } else {
                entry._text = event.target.value;
            }

            renderValidationPanel();
        });

        block.appendChild(input);
    }

    function addMetadataEntry(def) {
        const md = getMetadata();
        if (!md) return;
        if (isDefinitionAtMax(def)) return;

        ensureMetadataNamespaces();

        const list = normalizeField(md, def.field);
        const entry = {
            _attributes: { ...(def.createAttributes || def.attributes || {}) }
        };

        if (def.ensureIdPrefix) {
            entry._attributes.id = generateUniqueId(def.ensureIdPrefix);
        }

        if (def.refinesTarget) {
            const target = findOrCreateRefinesTarget(def.refinesTarget);
            entry._attributes.refines = `#${target._attributes.id}`;
        }

        if (def.editors) {
            def.editors.forEach(editor => {
                if (editor.text) {
                    entry._text = editor.defaultValue || "";
                } else {
                    entry._attributes[editor.attr] = editor.defaultValue || "";
                }
            });
        } else if (def.attrValue) {
            entry._attributes[def.attrValue] = "";
        } else {
            entry._text = typeof def.defaultText === "function"
                ? def.defaultText()
                : def.defaultText || "";
        }

        list.push(entry);

        if (def.attributes?.property === "belongs-to-collection") {
            findOrCreateMetaRefinement(entry, "collection-type", {
                idPrefix: "collection",
                defaultText: "series"
            });
        }

        if (def.defaultCreatorRole && def.field === "dc:creator") {
            findOrCreateMetaRefinement(entry, "role", {
                idPrefix: "creator",
                attributes: { scheme: "marc:relators" },
                defaultText: def.defaultCreatorRole
            });
            syncCreatorDisplaySequences();
        }
    }

    function getEntriesForDefinition(def, md) {
        const list = normalizeField(md, def.field);

        if (def.attributes) {
            return list.filter(entry => hasMatchingAttributes(entry, def.attributes));
        }

        const otherDefs = metadataDefinitions.filter(
            candidate => candidate.field === def.field && candidate.attributes
        );

        return list.filter(entry => {
            return !otherDefs.some(candidate => hasMatchingAttributes(entry, candidate.attributes));
        });
    }

    function removeMetadataEntry(def, entry) {
        const md = getMetadata();
        if (!md?.[def.field]) return;

        const list = normalizeField(md, def.field);
        md[def.field] = list.filter(candidate => candidate !== entry);

        if (md[def.field].length === 0) {
            delete md[def.field];
        }
    }

    function moveMetadataEntry(field, fromIndex, toIndex) {
        const md = getMetadata();
        const list = normalizeField(md, field);
        if (toIndex < 0 || toIndex >= list.length) return;

        const [entry] = list.splice(fromIndex, 1);
        list.splice(toIndex, 0, entry);
        syncCreatorDisplaySequences();
    }

    async function loadEpub(file) {
        zip = await JSZip.loadAsync(file);
        packagePath = await findPackagePath(zip);

        if (!packagePath) {
            alert("content.opf not found in this EPUB");
            return;
        }

        const xmlText = await zip.files[packagePath].async("text");
        window.bookJson = xmlToJson(xmlText);
        window.fileName = file.name;

        const version = window.bookJson.package?._attributes?.version || "unknown";
        window.epubVersion = version;
        metadataDefinitions = getDefinitionsForVersion(version);

        ensureMetadataNamespaces();
        renderSidePanel();
        renderMetadataUI();

        document.getElementById("editorSection").style.display = "block";
    }

    async function findPackagePath(epubZip) {
        const container = epubZip.files["META-INF/container.xml"];

        if (container) {
            const xmlText = await container.async("text");
            const containerJson = xmlToJson(xmlText);
            const rootfiles = containerJson.container?.rootfiles?.rootfile;
            const firstRootfile = asArray(rootfiles)[0];
            const fullPath = firstRootfile?._attributes?.["full-path"];

            if (fullPath && epubZip.files[fullPath]) {
                return fullPath;
            }
        }

        return fallbackPackagePaths.find(path => epubZip.files[path]) || null;
    }

    function xmlToJson(xmlText) {
        return JSON.parse(
            convert.xml2json(xmlText, { compact: true, spaces: 2 })
        );
    }

    function jsonToXml(jsonObj) {
        return convert.json2xml(
            JSON.stringify(jsonObj),
            { compact: true, spaces: 2 }
        );
    }

    async function saveEpub() {
        if (!zip || !window.bookJson || !packagePath) {
            alert("Upload an EPUB first");
            return;
        }

        syncCreatorDisplaySequences();
        renderValidationPanel();

        const newXml = jsonToXml(window.bookJson);
        zip.file(packagePath, newXml);

        const newEpubBlob = await zip.generateAsync({ type: "blob" });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(newEpubBlob);
        a.download = window.fileName;
        a.click();
    }

    function renderValidationPanel() {
        const panel = document.getElementById("validationPanel");
        const issues = validateMetadata();

        panel.innerHTML = "";

        if (!issues.length) {
            const ok = document.createElement("div");
            ok.className = "validation-message validation-info";
            ok.textContent = "No metadata issues detected.";
            panel.appendChild(ok);
            return;
        }

        issues.forEach(issue => {
            const row = document.createElement("div");
            row.className = `validation-message validation-${issue.severity}`;
            row.textContent = `${issue.severity.toUpperCase()}: ${issue.message}`;
            panel.appendChild(row);
        });
    }

    function isRequiredMetaValue(entry) {
        const property = entry._attributes?.property;

        if (property === "dcterms:modified" && !entry._attributes?.refines) {
            return true;
        }

        if (property === "role" && entry._attributes?.refines) {
            return true;
        }

        return !entry._attributes?.refines;
    }

    function validateMetadata() {
        const pkg = getPackage();
        const md = getMetadata();
        const issues = [];

        if (!pkg || !md) {
            return [{ severity: "error", message: "No package metadata found." }];
        }

        const identifiers = asArray(md["dc:identifier"]);
        const titles = asArray(md["dc:title"]);
        const languages = asArray(md["dc:language"]);
        const dates = asArray(md["dc:date"]);
        const metaEntries = asArray(md.meta);
        const primaryModified = metaEntries.filter(entry =>
            entry._attributes?.property === "dcterms:modified" && !entry._attributes?.refines
        );

        if (!identifiers.length) issues.push({ severity: "error", message: "Missing required dc:identifier." });
        if (!titles.length) issues.push({ severity: "error", message: "Missing required dc:title." });
        if (!languages.length) issues.push({ severity: "error", message: "Missing required dc:language." });

        if (window.epubVersion.startsWith("3")) {
            if (!primaryModified.length) {
                issues.push({ severity: "error", message: "Missing required primary meta property=\"dcterms:modified\"." });
            }

            if (primaryModified.length > 1) {
                issues.push({ severity: "error", message: "More than one primary dcterms:modified value." });
            }

            primaryModified.forEach(entry => {
                if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(getEntryText(entry).trim())) {
                    issues.push({ severity: "error", message: "dcterms:modified must use YYYY-MM-DDThh:mm:ssZ in UTC." });
                }
            });

            primaryModified.forEach(entry => {
                if (isRequiredMetaValue(entry) && !getEntryText(entry).trim()) {
                    issues.push({ severity: "error", message: "dcterms:modified has an empty value." });
                }
            });
        }

        if (window.epubVersion.startsWith("3") && dates.length > 1) {
            issues.push({ severity: "error", message: "dc:date must not appear more than once in EPUB 3." });
        }

        dates.forEach(entry => {
            const value = getEntryText(entry).trim();
            if (value && !/^\d{4}(-\d{2}(-\d{2})?)?(T.*)?$/.test(value)) {
                issues.push({ severity: "warning", message: `dc:date "${value}" is not ISO-style. Prefer YYYY-MM-DD.` });
            }
        });

        languages.forEach(entry => {
            const value = getEntryText(entry).trim();
            if (value && !/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(value)) {
                issues.push({ severity: "error", message: `dc:language "${value}" is not a well-formed language tag.` });
            }
        });

        const uniqueIdentifier = pkg._attributes?.["unique-identifier"];
        if (uniqueIdentifier && !identifiers.some(entry => entry._attributes?.id === uniqueIdentifier)) {
            issues.push({ severity: "error", message: `package unique-identifier "${uniqueIdentifier}" does not match a dc:identifier id.` });
        }

        const ids = collectIds(window.bookJson);
        const duplicatedIds = ids.filter((id, index) => ids.indexOf(id) !== index);
        [...new Set(duplicatedIds)].forEach(id => {
            issues.push({ severity: "error", message: `Duplicate id "${id}".` });
        });

        if (languages.length > 1) {
            issues.push({ severity: "info", message: "Multiple dc:language values are allowed; the first one is primary." });
        }

        if (titles.length > 1) {
            issues.push({ severity: "info", message: "Multiple dc:title values are allowed, but reading-system support varies." });
        }

        return issues;
    }

    document.getElementById("zipInput").addEventListener("change", event => {
        const file = event.target.files[0];
        if (file) loadEpub(file);
    });

    document.getElementById("saveBtn").addEventListener("click", saveEpub);
    document.getElementById("backToTopBtn").addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
});
