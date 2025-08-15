import * as XLSX from 'xlsx';

// --- Constants and State ---
const mainContent = document.getElementById('main-content');
const aulaTemplate = document.getElementById('aula-template');
const addAulaBtn = document.getElementById('add-aula-btn');
const formatAllBtn = document.getElementById('format-all-btn');
const exportAllBtn = document.getElementById('export-all-btn');
const exportXlsxBtn = document.getElementById('export-xlsx-btn');
const projectNameInput = document.getElementById('project-name-input');

// Metadata Inputs
const responsibleNotesInput = document.getElementById('responsible-notes-input');
const responsibleEditorInput = document.getElementById('responsible-editor-input');
const courseInput = document.getElementById('course-input');
const phaseInput = document.getElementById('phase-input');
const disciplineInput = document.getElementById('discipline-input');

// Project Management Buttons
const saveLocalBtn = document.getElementById('save-local-btn');
const downloadProjectBtn = document.getElementById('download-project-btn');
const loadProjectSelect = document.getElementById('load-project-select');
const uploadProjectBtn = document.getElementById('upload-project-btn');
const projectFileInput = document.getElementById('project-file-input');
const deleteProjectBtn = document.getElementById('delete-project-btn');

// App Tabs
const instructionsTab = document.getElementById('instructions-tab');
const backgroundTab = document.getElementById('background-tab');
const optionsTab = document.getElementById('options-tab');

// Global Prompt
const globalPromptContainer = document.getElementById('global-prompt-container');
const globalPromptTextarea = document.getElementById('global-prompt-textarea');

// File Drop Zone
const fileDropZone = document.getElementById('file-drop-zone');
const textFileInput = document.getElementById('text-file-input');

// Revs
const revContainer = document.getElementById('rev-container');
const revTabsContainer = document.getElementById('rev-tabs');
const revContentsContainer = document.getElementById('rev-contents');
let addRevBtn = document.getElementById('add-rev-btn');

let aulaCounter = 0;
let revCounter = 0;
let draggedElement = null;
let settings = {};
let autosaveIntervalId = null;
let frequentComments = [];
let keyShortcuts = {};

// --- Modal Functions ---
const modalOverlay = document.getElementById('modal-overlay');
const modalContainer = document.getElementById('modal-container');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalPrompt = document.getElementById('modal-prompt');
const modalInput = document.getElementById('modal-input');
const modalButtons = document.getElementById('modal-buttons');
const modalContent = document.getElementById('modal-content');

function showModal(config) {
    modalTitle.textContent = config.title;
    document.body.classList.add('modal-open');

    // Clear previous custom content & message
    modalMessage.innerHTML = '';
    const existingCustom = modalContent.querySelector('.custom-modal-content');
    if (existingCustom) existingCustom.remove();

    modalMessage.textContent = config.message || '';
    modalButtons.innerHTML = '';
    modalPrompt.classList.add('hidden');

    if (config.customContent) {
        const customWrapper = document.createElement('div');
        customWrapper.className = 'custom-modal-content';
        // It can be a node or an HTML string
        if (typeof config.customContent === 'string') {
            customWrapper.innerHTML = config.customContent;
        } else {
            customWrapper.appendChild(config.customContent);
        }
        modalContent.appendChild(customWrapper);
        if(!config.message) modalMessage.style.display = 'none';
    } else {
        modalMessage.style.display = 'block';
    }

    if (config.prompt) {
        modalPrompt.classList.remove('hidden');
        modalInput.value = config.prompt.defaultValue || '';
        modalInput.placeholder = config.prompt.placeholder || '';
    }

    config.buttons.forEach(btnConfig => {
        const button = document.createElement('button');
        button.textContent = btnConfig.text;
        button.className = btnConfig.class || '';
        button.onclick = (e) => {
            e.stopPropagation();
            if (btnConfig.onClick) {
                btnConfig.onClick();
            }
            // Only hide modal if it's not a download button that needs the content to exist
            if(btnConfig.text !== 'Baixar como PDF') {
                hideModal();
            }
        };
        modalButtons.appendChild(button);
    });

    modalOverlay.classList.remove('hidden');
    if(config.prompt) modalInput.focus();
}

function hideModal() {
    modalOverlay.classList.add('hidden');
    document.body.classList.remove('modal-open');
}
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) hideModal();
});

// --- Core "Aula" Functions ---

function createAula(data = {}) {
    const isNewCreation = !data.title; // Check if it's a new aula being added by the user
    aulaCounter++;

    let aulaNumber;
    if (isNewCreation) {
        const activeAulasContainer = document.querySelector('.rev-content.active .aulas-container');
        const existingAulas = Array.from(activeAulasContainer.querySelectorAll('.aula-title'))
            .map(titleEl => {
                const match = titleEl.textContent.match(/^Aula\s+([\d\.]+)/);
                if (!match) return null;
                const parts = match[1].split('.').map(Number);
                return { major: parts[0], minor: parts.length > 1 ? parts[1] : -1 }; // use -1 for no minor
            })
            .filter(n => n !== null);

        if (existingAulas.length === 0) {
            aulaNumber = "0";
        } else {
            // Find max major
            const maxMajor = Math.max(...existingAulas.map(a => a.major));
            // Filter to aulas with max major
            const aulasWithMaxMajor = existingAulas.filter(a => a.major === maxMajor);
            // Find max minor in that group
            const maxMinor = Math.max(...aulasWithMaxMajor.map(a => a.minor));

            if (maxMinor > -1) {
                // if there was a minor version, increment it
                aulaNumber = `${maxMajor}.${maxMinor + 1}`;
            } else {
                // if no minor version for the highest major, increment major
                aulaNumber = `${maxMajor + 1}`;
            }
        }
    } else {
        // Use provided title or fallback to counter for loaded projects
        aulaNumber = aulaCounter - 1;
    }

    const aulaId = `aula-${aulaCounter}`;
    const newAula = aulaTemplate.content.cloneNode(true).firstElementChild;
    newAula.id = aulaId;

    const titleEl = newAula.querySelector('.aula-title');
    const multipartCheckbox = newAula.querySelector('.multipart-checkbox');
    const inlineModeCheckbox = newAula.querySelector('.inline-mode-checkbox');
    const lessThanOneHourOption = newAula.querySelector('.lessthan-one-hour-option');
    const inputsWrapper = newAula.querySelector('.inputs-wrapper');
    const outputTextarea = newAula.querySelector('.output-textarea');
    const aulaContent = newAula.querySelector('.aula-content');
    const addPartBtn = newAula.querySelector('.add-part-btn');
    const inlineControls = newAula.querySelector('.inline-input-controls');

    // Set unique IDs for labels and inputs to maintain association
    const multipartCheckboxId = `multipart-checkbox-${aulaId}`;
    multipartCheckbox.id = multipartCheckboxId;
    newAula.querySelector('.multipart-option label').htmlFor = multipartCheckboxId;

    // Restore data or set defaults
    titleEl.textContent = data.title || `Aula ${aulaNumber}`;
    if (data.output) outputTextarea.value = data.output;
    aulaContent.style.display = data.collapsed ? 'none' : 'grid';
    newAula.querySelector('.expand-collapse-btn').textContent = data.collapsed ? '►' : '▼';
    if(data.output) newAula.querySelector('.copy-btn').style.display = 'block';

    // Store both input types' data to preserve state when toggling
    newAula.dataset.textInputs = JSON.stringify(data.inputs || ['']);
    newAula.dataset.inlineInputs = JSON.stringify(data.inlineInputs || null);

    inlineModeCheckbox.addEventListener('change', () => {
        toggleInlineMode(newAula);
    });

    lessThanOneHourOption.querySelector('.lessthan-one-hour-checkbox').addEventListener('change', () => {
        updateInlineTimeFields(newAula);
    });

    // Event listeners for inline controls, which are part of the template now
    inlineControls.querySelector('.add-part-btn-inline').addEventListener('click', () => {
        const parts = inputsWrapper.querySelectorAll('.inline-part-container');
        const newPartNum = parts.length + 1;

        // This is a simplified addPartSection, specific for this button.
        const partContainer = document.createElement('div');
        partContainer.className = 'inline-part-container';
        partContainer.dataset.partNumber = newPartNum;

        const partTitle = document.createElement('div');
        partTitle.className = 'input-part-title';
        partTitle.textContent = `Parte ${newPartNum}`;
        partContainer.appendChild(partTitle);

        const partControls = document.createElement('div');
        partControls.className = 'inline-part-controls';
        const addRowBtn = document.createElement('button');
        addRowBtn.className = 'add-row-btn';
        addRowBtn.textContent = '+ Marcação';
        addRowBtn.onclick = () => addInlineInputRow(partContainer);
        partControls.appendChild(addRowBtn);
        partContainer.appendChild(partControls);

        inputsWrapper.appendChild(partContainer);
        addInlineInputRow(partContainer);

        inlineControls.querySelector('.remove-last-part-btn').disabled = false;
    });

    inlineControls.querySelector('.remove-last-part-btn').addEventListener('click', () => {
        const partContainers = inputsWrapper.querySelectorAll('.inline-part-container');
        if (partContainers.length > 1) {
            partContainers[partContainers.length - 1].remove();
        }
        if(inputsWrapper.querySelectorAll('.inline-part-container').length <= 1) {
            inlineControls.querySelector('.remove-last-part-btn').disabled = true;
        }
    });

    // Default to inline mode for new aulas
    if (isNewCreation) {
        data.inlineMode = true;
    }

    // Restore inline mode state if it exists or is default
    if (data.inlineMode) {
        inlineModeCheckbox.checked = true;
        toggleInlineMode(newAula);
    } else {
        // Create initial input parts based on saved data or default (for non-inline mode)
        const inputs = JSON.parse(newAula.dataset.textInputs);
        inputs.forEach((inputValue, index) => {
            const partTextarea = createInputPart(newAula, inputsWrapper, index + 1);
            partTextarea.value = inputValue;
        });

        if (inputs.length > 1 && !data.inlineMode) {
            multipartCheckbox.checked = true;
        }
    }

    const activeAulasContainer = document.querySelector('.rev-content.active .aulas-container');
    if (activeAulasContainer) {
        activeAulasContainer.appendChild(newAula);
    }

    // Initial state for buttons
    addPartBtn.style.display = newAula.querySelector('.multipart-checkbox').checked ? 'block' : 'none';
    inlineControls.style.display = inlineModeCheckbox.checked ? 'flex' : 'none';
    if(inlineModeCheckbox.checked) {
        inlineControls.querySelector('.remove-last-part-btn').disabled = newAula.querySelectorAll('.inline-part-container').length <= 1;
    }

    updateInputLabelsAndButtons(newAula);
    return newAula;
}

function createInputPart(aulaEl, wrapper, partNumber) {
    const container = document.createElement('div');
    container.className = 'input-part-container textarea-group';

    const label = document.createElement('label');
    const textarea = document.createElement('textarea');
    textarea.className = 'input-part-textarea';
    textarea.placeholder = `Cole a parte ${partNumber} do texto aqui...`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-part-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'remover esta parte';
    removeBtn.onclick = () => {
        container.remove();
        if (wrapper.childElementCount < 2) {
            aulaEl.querySelector('.multipart-checkbox').checked = false;
        }
        updateInputLabelsAndButtons(aulaEl);
        // Save text state after removal
        const textInputs = Array.from(wrapper.querySelectorAll('.input-part-textarea')).map(ta => ta.value);
        aulaEl.dataset.textInputs = JSON.stringify(textInputs);
    };

    container.appendChild(label);
    container.appendChild(textarea);
    container.appendChild(removeBtn);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    container.appendChild(resizeHandle);

    wrapper.appendChild(container);

    textarea.addEventListener('input', () => {
        const textInputs = Array.from(wrapper.querySelectorAll('.input-part-textarea')).map(ta => ta.value);
        aulaEl.dataset.textInputs = JSON.stringify(textInputs);
    });

    return textarea;
}

function updateInputLabelsAndButtons(aulaEl) {
    const parts = aulaEl.querySelectorAll('.input-part-container');
    const isMultipart = aulaEl.querySelector('.multipart-checkbox').checked;
    const isInlineMode = aulaEl.querySelector('.inline-mode-checkbox').checked;
    const mainInputLabel = aulaEl.querySelector('.main-input-label');
    const addPartBtn = aulaEl.querySelector('.add-part-btn');

    mainInputLabel.textContent = isMultipart ? 'Inputs (Texto Original)' : 'Input (Texto Original)';

    parts.forEach((part, index) => {
        const partNumber = index + 1;
        const label = part.querySelector('label');
        const removeBtn = part.querySelector('.remove-part-btn');
        if (label) label.textContent = isMultipart ? `Input parte ${partNumber}` : '';
        if (removeBtn) removeBtn.style.display = isMultipart && parts.length > 1 ? 'flex' : 'none';
    });

    addPartBtn.style.display = isMultipart && !isInlineMode ? 'block' : 'none';
}

function getAulaState(aulaEl) {
    const isInlineMode = aulaEl.querySelector('.inline-mode-checkbox').checked;
    const isLessThanOneHour = aulaEl.querySelector('.lessthan-one-hour-checkbox').checked;
    const wrapper = aulaEl.querySelector('.inputs-wrapper');

    // Always get the latest inline state from the UI if it's active
    if (isInlineMode) {
        const partContainers = wrapper.querySelectorAll('.inline-part-container');
        const inlineInputs = Array.from(partContainers).map(partContainer => {
            return Array.from(partContainer.querySelectorAll('.inline-input-row')).map(row => ({
                entrada: row.querySelector('input[name="entrada"]').value,
                saida: row.querySelector('input[name="saida"]').value,
                comentario: row.querySelector('input[name="comentario"]').value
            }));
        });
        aulaEl.dataset.inlineInputs = JSON.stringify(inlineInputs);
    } else {
        // Always get the latest text state from the UI if it's not inline
        const textInputs = Array.from(wrapper.querySelectorAll('.input-part-textarea')).map(ta => ta.value);
        aulaEl.dataset.textInputs = JSON.stringify(textInputs);
    }

    return {
        title: aulaEl.querySelector('.aula-title').textContent,
        output: aulaEl.querySelector('.output-textarea').value,
        // Send back the preserved data, not just what's currently visible
        inputs: JSON.parse(aulaEl.dataset.textInputs),
        inlineInputs: JSON.parse(aulaEl.dataset.inlineInputs),
        collapsed: aulaEl.querySelector('.aula-content').style.display === 'none',
        inlineMode: isInlineMode,
        lessThanOneHour: isLessThanOneHour
    };
}

function toggleInlineMode(aulaEl) {
    const isInlineMode = aulaEl.querySelector('.inline-mode-checkbox').checked;
    const multipartOption = aulaEl.querySelector('.multipart-option');
    const lessThanOneHourOption = aulaEl.querySelector('.lessthan-one-hour-option');
    const wrapper = aulaEl.querySelector('.inputs-wrapper');
    const addPartBtn = aulaEl.querySelector('.add-part-btn');
    const inlineControls = aulaEl.querySelector('.inline-input-controls');

    // Hide multipart option and show 'less than 1h' option when inline mode is active
    multipartOption.style.display = isInlineMode ? 'none' : 'flex';
    lessThanOneHourOption.style.display = isInlineMode ? 'flex' : 'none';
    addPartBtn.style.display = isInlineMode ? 'none' : (aulaEl.querySelector('.multipart-checkbox').checked ? 'block' : 'none');
    inlineControls.style.display = isInlineMode ? 'flex' : 'none';

    wrapper.innerHTML = ''; // Clear existing inputs

    if (isInlineMode) {
        // --- Switching TO inline mode ---
        const inlineData = JSON.parse(aulaEl.dataset.inlineInputs);
        const textData = JSON.parse(aulaEl.dataset.textInputs);

        const header = document.createElement('div');
        header.className = 'inline-input-header';
        header.innerHTML = `
            <span>Entrada</span>
            <span>Saída</span>
            <span>Comentários</span>
            <span></span>
        `;

        wrapper.appendChild(header);

        const addPartSection = (partNumber, rowsData = null) => {
            const partContainer = document.createElement('div');
            partContainer.className = 'inline-part-container';
            partContainer.dataset.partNumber = partNumber;

            const partTitle = document.createElement('div');
            partTitle.className = 'input-part-title';
            partTitle.textContent = `Parte ${partNumber}`;
            partContainer.appendChild(partTitle);

            const partControls = document.createElement('div');
            partControls.className = 'inline-part-controls';
            const addRowBtn = document.createElement('button');
            addRowBtn.className = 'add-row-btn';
            addRowBtn.textContent = '+ Marcação';
            addRowBtn.onclick = () => addInlineInputRow(partContainer);
            partControls.appendChild(addRowBtn);
            partContainer.appendChild(partControls);

            wrapper.appendChild(partContainer);

            if (rowsData && rowsData.length > 0) {
                rowsData.forEach(rowData => addInlineInputRow(partContainer, rowData));
            } else {
                addInlineInputRow(partContainer); // Add one empty row for a new part
            }
        };

        if (inlineData) {
            // Restore from previously saved inline state
            inlineData.forEach((partRows, index) => {
                addPartSection(index + 1, partRows);
            });
        } else if (textData && textData.some(t => t.trim() !== '')) {
            // Convert from text state if no inline state exists
            textData.forEach((textPart, index) => {
                const lines = textPart.split('\n');
                const rowsData = lines.map(line => parseLine(line)).filter(p => p);
                addPartSection(index + 1, rowsData);
            });
        } else {
            // Create a fresh inline input section
            addPartSection(1);
        }

        // Initial state for remove button
        inlineControls.querySelector('.remove-last-part-btn').disabled = wrapper.querySelectorAll('.inline-part-container').length <= 1;

    } else {
        // --- Switching TO textarea mode ---
        const textInputs = JSON.parse(aulaEl.dataset.textInputs);
        const inlineInputs = JSON.parse(aulaEl.dataset.inlineInputs);

        // Restore multipart checkbox visibility
        multipartOption.style.display = 'flex';

        if (textInputs && textInputs.some(t => t.trim() !== '')) {
            // Restore from previously saved text state
            textInputs.forEach((text, index) => {
                createInputPart(aulaEl, wrapper, index + 1).value = text;
            });
            aulaEl.querySelector('.multipart-checkbox').checked = textInputs.length > 1;

        } else if (inlineInputs) {
            // Convert from inline state if no text state exists
            inlineInputs.forEach((part, index) => {
                const combinedText = part.map(row => {
                    if (!row.entrada && !row.saida && !row.comentario) return '';
                    return `${row.entrada || ''}\t${row.saida || ''}\t${row.comentario || ''}`.trim();
                })
                    .filter(text => text)
                    .join('\n');

                createInputPart(aulaEl, wrapper, index + 1).value = combinedText;
            });
            const allText = Array.from(wrapper.querySelectorAll('.input-part-textarea')).map(ta => ta.value);
            aulaEl.dataset.textInputs = JSON.stringify(allText); // Store the converted text
            aulaEl.querySelector('.multipart-checkbox').checked = inlineInputs.length > 1;
        } else {
            // Create a fresh text input
            createInputPart(aulaEl, wrapper, 1).value = '';
        }
    }

    // Add event listeners for new buttons
    wrapper.querySelectorAll('.add-row-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const container = btn.closest('.inline-part-container');
            if (container) {
                addInlineInputRow(container);
            }
        });
    });

    wrapper.querySelectorAll('.remove-row-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('.inline-input-row');
            const container = e.target.closest('.inline-part-container');
            if (container && container.querySelectorAll('.inline-input-row').length > 1) { // Always keep at least one row in a part
                row.remove();
            }
        });
    });

    updateInputLabelsAndButtons(aulaEl);
}

function formatTimeInput(input) {
    let value = input.value.replace(/\D/g, '');

    if (value.length > 6) {
        value = value.substr(0, 6);
    }

    if (value.length >= 4) {
        const seconds = value.substr(-2);
        const minutes = value.substr(-4, 2);
        const hours = value.substr(0, value.length - 4);
        input.value = `${hours.padStart(2, '0')}:${minutes}:${seconds}`;
    } else if (value.length >= 2) {
        const minutes = value.substr(0, value.length - 2);
        const seconds = value.substr(-2);
        input.value = `00:${minutes.padStart(2, '0')}:${seconds}`;
    } else {
        input.value = `00:00:${value.padStart(2, '0')}`;
    }
}

function validateInputs(aulaEl) {
    const isInlineMode = aulaEl.querySelector('.inline-mode-checkbox').checked;
    if (!isInlineMode) return true;

    const rows = aulaEl.querySelectorAll('.inline-input-row');
    let isValid = true;
    let errorMessage = '';

    rows.forEach((row, index) => {
        const entrada = row.querySelector('input[name="entrada"]').value;
        const saida = row.querySelector('input[name="saida"]').value;

        if ((!entrada && saida) || (entrada && !saida)) {
            isValid = false;
            errorMessage = `Linha ${index + 1}: Os campos de Entrada e Saída devem estar ambos preenchidos ou ambos vazios.`;
            return;
        }
    });

    if (!isValid) {
        showModal({
            title: 'Erro de Validação',
            message: errorMessage,
            buttons: [{ text: 'OK', class: 'primary' }]
        });
    }

    return isValid;
}

function updateInlineTimeFields(aulaEl) {
    const isLessThanOneHour = aulaEl.querySelector('.lessthan-one-hour-checkbox').checked;
    const timeInputs = aulaEl.querySelectorAll('.inline-input-row input[name="entrada"], .inline-input-row input[name="saida"]');

    const maxLength = isLessThanOneHour ? 5 : 8; // MM:SS vs HH:MM:SS
    const placeholder = isLessThanOneHour ? 'MM:SS' : 'HH:MM:SS';

    timeInputs.forEach(input => {
        input.maxLength = maxLength;
        input.placeholder = placeholder;

        let value = input.value;
        if (value) {
            let digits = value.replace(/\D/g, '');
            if (isLessThanOneHour) {
                // From HH:MM:SS to MM:SS
                if (digits.length > 4) {
                    digits = digits.substring(digits.length - 4);
                }
                if(digits.length > 0) {
                    const masked = digits.padStart(4, '0');
                    input.value = `${masked.substring(0, 2)}:${masked.substring(2, 4)}`;
                }
            } else {
                // From MM:SS to HH:MM:SS
                if (digits.length > 0) {
                    const masked = digits.padStart(6, '0');
                    input.value = `${masked.substring(0, 2)}:${masked.substring(2, 4)}:${masked.substring(4, 6)}`;
                }
            }
        }
        // Re-validate after changing format
        if (input.value) {
            const isValid = validateTimeFormat(input.value, isLessThanOneHour);
            input.classList.toggle('invalid-input', !isValid);
        } else {
            input.classList.remove('invalid-input');
        }
    });
}

function addInlineInputRow(wrapper, data = null) {
    const aulaEl = wrapper.closest('.aula-container');
    const isLessThanOneHour = aulaEl.querySelector('.lessthan-one-hour-checkbox').checked;

    const row = document.createElement('div');
    row.className = 'inline-input-row';

    const entrada = document.createElement('input');
    entrada.type = 'text';
    entrada.name = 'entrada';
    entrada.placeholder = isLessThanOneHour ? 'MM:SS' : 'HH:MM:SS';
    entrada.value = data ? data.entrada : '';
    entrada.maxLength = isLessThanOneHour ? 5 : 8;

    const saida = document.createElement('input');
    saida.type = 'text';
    saida.name = 'saida';
    saida.placeholder = isLessThanOneHour ? 'MM:SS' : 'HH:MM:SS';
    saida.value = data ? data.saida : '';
    saida.maxLength = isLessThanOneHour ? 5 : 8;

    const commentWrapper = document.createElement('div');
    commentWrapper.className = 'comment-wrapper';

    const comentario = document.createElement('input');
    comentario.type = 'text';
    comentario.name = 'comentario';
    comentario.className = 'comment-input';
    comentario.placeholder = 'Comentário (opcional)';
    comentario.value = data ? data.comentario : '';

    const saveCommentBtn = document.createElement('button');
    saveCommentBtn.className = 'comment-btn';
    saveCommentBtn.innerHTML = '💾';
    saveCommentBtn.title = 'Salvar como comentário frequente';

    commentWrapper.appendChild(comentario);
    commentWrapper.appendChild(saveCommentBtn);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-row-btn';
    removeBtn.innerHTML = '🗑️';
    removeBtn.title = 'Remover marcação';

    row.appendChild(entrada);
    row.appendChild(saida);
    row.appendChild(commentWrapper);
    row.appendChild(removeBtn);

    // Time input masking logic
    const timeInputHandler = (e) => {
        const input = e.target;
        const currentIsLessThanOneHour = aulaEl.querySelector('.lessthan-one-hour-checkbox').checked;
        const maxDigits = currentIsLessThanOneHour ? 4 : 6;

        let value = input.value.replace(/\D/g, ''); // Remove all non-digits
        if (value.length > maxDigits) {
            value = value.substring(0, maxDigits);
        }

        let maskedValue = '';
        if (currentIsLessThanOneHour) { // MM:SS format
            if (value.length > 2) {
                maskedValue = `${value.substring(0, value.length - 2)}:${value.substring(value.length - 2)}`;
            } else {
                maskedValue = value;
            }
        } else { // HH:MM:SS format
            if (value.length > 4) {
                maskedValue = `${value.substring(0, value.length - 4)}:${value.substring(value.length - 4, value.length - 2)}:${value.substring(value.length - 2)}`;
            } else if (value.length > 2) {
                maskedValue = `${value.substring(0, value.length - 2)}:${value.substring(value.length - 2)}`;
            } else {
                maskedValue = value;
            }
        }

        // This logic helps prevent the cursor from jumping
        const caretPos = input.selectionStart;
        input.value = maskedValue;
        if(e.inputType !== 'deleteContentBackward' && maskedValue.length > value.length -1 ) {
            input.selectionStart = caretPos + 1;
            input.selectionEnd = caretPos + 1;
        }
    };

    // Add time input formatting
    [entrada, saida].forEach(input => {
        input.addEventListener('input', timeInputHandler);

        input.addEventListener('blur', () => {
            const currentIsLessThanOneHour = aulaEl.querySelector('.lessthan-one-hour-checkbox').checked;
            let value = input.value;
            if (value && value.length > 0 && value.length < (currentIsLessThanOneHour ? 5 : 8)) {
                let digits = value.replace(/\D/g, '');
                if (currentIsLessThanOneHour) {
                    digits = digits.padEnd(4, '0');
                    input.value = `${digits.substring(0, 2)}:${digits.substring(2, 4)}`;
                } else {
                    digits = digits.padEnd(6, '0');
                    input.value = `${digits.substring(0, 2)}:${digits.substring(2, 4)}:${digits.substring(4, 6)}`;
                }
            }

            if (value) {
                const isValid = validateTimeFormat(input.value, currentIsLessThanOneHour);
                input.classList.toggle('invalid-input', !isValid);
            } else {
                input.classList.remove('invalid-input');
            }
        });
    });

    saveCommentBtn.addEventListener('click', () => {
        const text = comentario.value.trim();
        if (text && !frequentComments.includes(text)) {
            frequentComments.push(text);
            saveFrequentComments();
            // Subtle feedback, maybe a tooltip or small message instead of a modal
            saveCommentBtn.style.color = 'var(--success-color)';
            setTimeout(() => { saveCommentBtn.style.color = ''; }, 1500);
        }
    });

    comentario.addEventListener('focus', () => {
        showFrequentCommentsPopup(comentario);
    });

    comentario.addEventListener('blur', () => {
        // Use a timeout to allow click on popup before it disappears
        setTimeout(() => {
            const popup = document.getElementById('frequent-comments-popup');
            // Check if the new focused element is inside the popup or the popup itself
            if (popup && !popup.contains(document.activeElement) && document.activeElement !== popup) {
                popup.remove();
            }
        }, 150);
    });

    removeBtn.addEventListener('click', () => {
        const container = row.closest('.inline-part-container');
        // Only remove if it's not the last row in the part
        if (container && container.querySelectorAll('.inline-input-row').length > 1) {
            row.remove();
        }
    });

    // Insert the row before the controls in the container
    const partControls = wrapper.querySelector('.inline-part-controls');
    if (partControls) {
        wrapper.insertBefore(row, partControls);
    } else {
        wrapper.appendChild(row);
    }

    return row;
}

function validateTimeFormat(value, isLessThanOneHour) {
    if (!value) return true; // Empty is allowed
    const pattern = isLessThanOneHour ? /^\d{2}:\d{2}$/ : /^\d{2}:\d{2}:\d{2}$/;
    return pattern.test(value);
}

function parseLine(line) {
    const timePattern = /(\d{2}:\d{2}(?::\d{2})?)/g;
    const times = line.match(timePattern);
    if (!times || times.length === 0) return null;

    return {
        entrada: times[0] || '',
        saida: times[1] || '',
        comentario: line.replace(timePattern, '').trim()
    };
}

// --- Event Handlers ---

async function formatAula(aulaEl, onProgress = null) {
    if (!validateInputs(aulaEl)) return;

    const formatBtn = aulaEl.querySelector('.format-btn');
    const outputTextarea = aulaEl.querySelector('.output-textarea');
    const copyBtn = aulaEl.querySelector('.copy-btn');
    const isInlineMode = aulaEl.querySelector('.inline-mode-checkbox').checked;

    let allInputs;
    let allParts;

    if (isInlineMode) {
        // When formatting, get data directly from inline fields
        const allParts = Array.from(aulaEl.querySelectorAll('.inline-part-container')).map(partContainer => {
            return Array.from(partContainer.querySelectorAll('.inline-input-row')).map(row => {
                const entrada = row.querySelector('input[name="entrada"]').value;
                const saida = row.querySelector('input[name="saida"]').value;
                const comentario = row.querySelector('input[name="comentario"]').value;
                if (!entrada && !saida && !comentario) return ''; // Skip empty rows
                return `${entrada || ''}\t${saida || ''}\t${comentario || ''}`.trim();
            }).filter(line => line).join('\n');
        });
        allInputs = allParts.join('\n\n---\n\n');
    } else {
        // When formatting, get data from text areas
        allInputs = Array.from(aulaEl.querySelectorAll('.input-part-textarea')).map(ta => ta.value.trim()).join('\n\n---\n\n');
    }

    const markerCountSpan = aulaEl.querySelector('.marker-count');

    // Auto-update title based on content
    const info = parseFileInfo(allInputs);
    if (info.aula !== null && info.video !== null) {
        const titleEl = aulaEl.querySelector('.aula-title');
        let newTitle = `Aula ${info.aula}.${info.video}`;

        let partCount;
        if(isInlineMode){
            partCount = aulaEl.querySelectorAll('.inline-part-container').length;
        } else {
            partCount = aulaEl.querySelectorAll('.input-part-container').length;
        }

        if (partCount > 1) {
            newTitle += ` (Partes 1-${partCount})`;
        }
        titleEl.textContent = newTitle;
    }

    if (!globalPromptTextarea.value.trim()) {
        showModal({ title: 'Erro', message: 'Por favor, forneça as instruções no "Prompt Geral".', buttons: [{ text: 'OK', class: 'primary' }] });
        return;
    }
    if (!allInputs.trim()) {
        showModal({ title: 'Erro', message: 'Por favor, forneça o texto a ser formatado.', buttons: [{ text: 'OK' }] });
        return;
    }

    formatBtn.disabled = true;
    formatBtn.textContent = 'Formatando...';
    outputTextarea.value = 'Aguarde, a IA está processando...';
    copyBtn.style.display = 'none';
    markerCountSpan.style.display = 'none';

    try {

        outputTextarea.value = completion.content;
        const markerCount = (completion.content.match(/^\d/gm) || []).length;
        if (markerCount > 0) {
            markerCountSpan.textContent = `${markerCount} Marcações`;
            markerCountSpan.style.display = 'inline-block';
        }
        if (onProgress) onProgress(); // Callback for progress tracking
    } catch (error) {

    }

    try {
        const GEMINI_API_KEY = document.getElementById('API_KEY').value.trim();
        const completion = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_API_KEY
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Você é um assistente que formata textos seguindo as instruções do usuário, respeitando tabulações e a estrutura do texto. INSTRUÇÕES:\n${promptGeneral}\n\nTEXTO DE ENTRADA:\n${allInputs}\n\nRESULTADO FORMATADO:`
                        }]
                    }]
                })
            }
        );

        if (!completion.ok) {
            const err = await completion.json();
            outputTextarea.value = `Erro na API: ${err.error?.message || 'Desconhecido'}`;
            return;
        }

        const data = await completion.json();
        outputTextarea.value = data.candidates[0].content.parts[0].text.trim();

        // 🔹 Aqui entra o cálculo igual ao do websim
        const markerCount = (outputTextarea.value.match(/^\d/gm) || []).length;
        if (markerCount > 0) {
            markerCountSpan.textContent = `${markerCount} Marcações`;
            markerCountSpan.style.display = 'inline-block';
        }

        if (onProgress) onProgress();
    } catch (error) {
        console.error('Erro na API:', error);
        outputTextarea.value = `Ocorreu um erro: ${error.message}`;
    } finally {
        formatBtn.disabled = false;
        formatBtn.textContent = 'Formatar';
        if (outputTextarea.value && !outputTextarea.value.startsWith('Ocorreu um erro')) {
            copyBtn.style.display = 'block';
        }
    }
}

document.getElementById('app').addEventListener('click', async (e) => {
    const target = e.target;
    const aulaEl = target.closest('.aula-container');

    // Expand/Collapse
    if (target.classList.contains('expand-collapse-btn')) {
        const content = aulaEl.querySelector('.aula-content');
        const isCollapsed = content.style.display === 'none';
        content.style.display = isCollapsed ? 'grid' : 'none';
        target.textContent = isCollapsed ? '▼' : '►';
        // After animation, if it's a Chart, redraw it.
        content.addEventListener('transitionend', () => {
            if (!isCollapsed && typeof window.renderChart === 'function') {
                const canvas = aulaEl.querySelector('.chart-canvas');
                if(canvas) window.renderChart(aulaEl);
            }
        }, { once: true });
    }

    // Export Individual
    if (target.classList.contains('export-individual-btn')) {
        const state = getAulaState(aulaEl);
        if (!state.output.trim()) {
            showModal({ title: 'Exportar', message: 'Nenhum resultado para exportar nesta aula.', buttons: [{ text: 'OK' }] });
            return;
        }
        const blob = new Blob([state.output], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = state.title.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase() || 'aula_formatada';
        a.download = `${filename}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    if (!aulaEl) return; // All handlers below require an aula container

    // Remove Aula
    if (target.classList.contains('remove-aula-btn')) {
        showModal({
            title: 'Confirmar Exclusão',
            message: `Tem certeza que deseja remover "${aulaEl.querySelector('.aula-title').textContent}"?`,
            buttons: [
                { text: 'Cancelar', class: 'secondary' },
                { text: 'Excluir', class: 'danger', onClick: () => aulaEl.remove() }
            ]
        });
        return; // Return to avoid closing modal immediately or other side effects
    }

    // Multipart Checkbox
    if (target.classList.contains('multipart-checkbox')) {
        const wrapper = aulaEl.querySelector('.inputs-wrapper');
        if (target.checked) {
            if (wrapper.childElementCount === 0) createInputPart(aulaEl, wrapper, 1);
            createInputPart(aulaEl, wrapper, 2);
        } else {
            const parts = Array.from(wrapper.querySelectorAll('.input-part-container'));
            parts.forEach((part, index) => { if (index > 0) part.remove(); });
        }
        updateInputLabelsAndButtons(aulaEl);

        // Save state after modification
        const textInputs = Array.from(wrapper.querySelectorAll('.input-part-textarea')).map(ta => ta.value);
        aulaEl.dataset.textInputs = JSON.stringify(textInputs);
    }

    // Add Part
    if (target.classList.contains('add-part-btn')) {
        const wrapper = aulaEl.querySelector('.inputs-wrapper');
        createInputPart(aulaEl, wrapper, wrapper.childElementCount + 1);
        updateInputLabelsAndButtons(aulaEl);
    }

    // Clear
    if (target.classList.contains('clear-btn')) {
        aulaEl.querySelectorAll('.input-part-textarea').forEach(ta => ta.value = '');
        const output = aulaEl.querySelector('.output-textarea');
        output.value = '';
        output.placeholder = 'O resultado formatado aparecerá aqui...';
        aulaEl.querySelector('.copy-btn').style.display = 'none';
        aulaEl.querySelector('.marker-count').style.display = 'none';
    }

    // Copy
    if (target.classList.contains('copy-btn')) {
        const output = aulaEl.querySelector('.output-textarea');
        if (!output.value) return;
        try {
            await navigator.clipboard.writeText(output.value);
            target.textContent = 'Copiado!';
            setTimeout(() => { target.textContent = 'Copiar'; }, 2000);
        } catch (err) {
            console.error('Falha ao copiar texto: ', err);
            target.textContent = 'Falhou!';
        }
    }

    // Format
    if (target.classList.contains('format-btn')) {
        await formatAula(aulaEl);
    }
});

// --- Drag and Drop Logic ---
revContentsContainer.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('aula-container')) {
        draggedElement = e.target;
        setTimeout(() => e.target.classList.add('dragging'), 0);
    }
});

revContentsContainer.addEventListener('dragend', (e) => {
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
    }
});

revContentsContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    const currentAulasContainer = e.target.closest('.aulas-container');
    if (!currentAulasContainer) return;

    const afterElement = getDragAfterElement(currentAulasContainer, e.clientY);
    const dragging = document.querySelector('.dragging');
    if (dragging) {
        if (afterElement == null) {
            currentAulasContainer.appendChild(dragging);
        } else {
            currentAulasContainer.insertBefore(dragging, afterElement);
        }
    }
});

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.aula-container:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// --- Textarea Resize Handle Logic ---
let resizing = {
    active: false,
    textarea: null,
    initialY: 0,
    initialHeight: 0
};

document.addEventListener('mousedown', e => {
    if (e.target.classList.contains('resize-handle')) {
        e.preventDefault();
        const textareaGroup = e.target.closest('.textarea-group');
        let textarea;
        // The main input group no longer has its own resize handle.
        // Handles are now on groups that directly contain a textarea.
        if (textareaGroup) {
            textarea = textareaGroup.querySelector('textarea, .output-textarea');
        }

        if (textarea) {
            resizing = {
                active: true,
                textarea: textarea,
                initialY: e.clientY,
                initialHeight: textarea.offsetHeight
            };
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
        }
    }
});

document.addEventListener('mousemove', e => {
    if (resizing.active) {
        e.preventDefault();
        const dy = e.clientY - resizing.initialY;
        const newHeight = resizing.initialHeight + dy;
        resizing.textarea.style.height = `${newHeight}px`;
    }
});

document.addEventListener('mouseup', () => {
    if (resizing.active) {
        resizing.active = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
});

// --- Global Actions & Project Management ---
addAulaBtn.addEventListener('click', () => createAula({collapsed: false}));

formatAllBtn.addEventListener('click', async () => {
    const allAulas = Array.from(document.querySelectorAll('#rev-contents .aula-container'));
    if (allAulas.length === 0) {
        showModal({ title: 'Atenção', message: 'Não há aulas para formatar.', buttons: [{ text: 'OK' }] });
        return;
    }

    const workingModalContent = document.createElement('div');
    workingModalContent.innerHTML = '<p>Formatando todas as aulas... Por favor, aguarde.</p><progress></progress>';
    showModal({
        title: 'Processando...',
        customContent: workingModalContent,
        buttons: []
    });

    try {
        const formatPromises = allAulas.map(aula => formatAula(aula));
        await Promise.all(formatPromises);
        setTimeout(() => {
            hideModal();
            setTimeout(() => {
                showModal({ title: 'Sucesso', message: 'Todas as aulas foram formatadas.', buttons: [{ text: 'OK' }] });
            }, 350);
        }, 500);
    } catch (error) {
        console.error("Error during batch formatting:", error);
        hideModal();
        setTimeout(() => {
            showModal({
                title: 'Erro de Formatação',
                message: 'Ocorreu um erro ao formatar as aulas. Verifique o console para mais detalhes.',
                buttons: [{text: 'OK'}]
            });
        }, 350);
    }
});

async function preExportCheck(exportFunction) {
    const aulas = Array.from(document.querySelectorAll('#rev-contents .aula-container'));
    const unformattedAulas = aulas.filter(aulaEl => {
        const outputEl = aulaEl.querySelector('.output-textarea');
        if (!outputEl) return false; // Should not happen with the corrected selector, but good for safety
        const output = outputEl.value.trim();
        return !output || output.startsWith('Aguarde') || output.startsWith('O resultado');
    });

    if (unformattedAulas.length > 0) {
        showModal({
            title: 'Aulas não formatadas',
            message: `Você tem ${unformattedAulas.length} aula(s) que ainda não foram formatadas. Deseja formatá-las agora antes de exportar?`,
            buttons: [
                { text: 'Cancelar', class: 'secondary' },
                {
                    text: 'Formatar e Exportar',
                    class: 'primary',
                    onClick: async () => {
                        hideModal(); // Hide the confirmation modal

                        // Show a "working" modal with a progress bar
                        let formattedCount = 0;
                        const workingModalContent = document.createElement('div');
                        workingModalContent.innerHTML = `<p>Formatando ${formattedCount}/${unformattedAulas.length} aulas... Por favor, aguarde.</p><progress id="batch-format-progress" value="0" max="${unformattedAulas.length}"></progress>`;

                        showModal({
                            title: 'Processando...',
                            customContent: workingModalContent,
                            buttons: []
                        });

                        const progressEl = document.getElementById('batch-format-progress');
                        const progressText = workingModalContent.querySelector('p');

                        const updateProgress = () => {
                            formattedCount++;
                            if (progressEl) progressEl.value = formattedCount;
                            if (progressText) progressText.textContent = `Formatando ${formattedCount}/${unformattedAulas.length} aulas... Por favor, aguarde.`;
                        };

                        try {
                            const formatPromises = unformattedAulas.map(aula => formatAula(aula, updateProgress));
                            await Promise.all(formatPromises);

                            // Brief pause to let UI update
                            setTimeout(() => {
                                hideModal();
                                setTimeout(() => exportFunction(), 100); // Call export after a short delay
                            }, 500);
                        } catch (error) {
                            console.error("Error during batch formatting:", error);
                            hideModal();
                            setTimeout(() => {
                                showModal({
                                    title: 'Erro de Formatação',
                                    message: 'Ocorreu um erro ao formatar as aulas. Verifique o console para mais detalhes.',
                                    buttons: [{text: 'OK'}]
                                })
                            }, 350);
                        }
                    }
                }
            ]
        });
    } else {
        exportFunction();
    }
}

function exportToTxt() {
    // 1. Validate required fields
    const requiredFields = {
        'Curso': courseInput.value,
        'Fase': phaseInput.value,
        'Disciplina': disciplineInput.value,
        'Responsável pelas notas': responsibleNotesInput.value
    };

    const emptyFields = Object.entries(requiredFields).filter(([_, value]) => !value.trim());
    if (emptyFields.length > 0) {
        const fieldNames = emptyFields.map(([name, _]) => name).join(', ');
        showModal({
            title: 'Campos Obrigatórios',
            message: `Por favor, preencha os seguintes campos antes de exportar: ${fieldNames}.`,
            buttons: [{ text: 'OK', class: 'primary' }]
        });
        return;
    }

    let fullText = '';
    const metadata = [
        `Nome da Decupagem: ${projectNameInput.value}`,
        `Responsável pelas Notas: ${responsibleNotesInput.value}`,
        `Responsável pela Edição: ${responsibleEditorInput.value}`,
        `Curso: ${courseInput.value}`,
        `Fase: ${phaseInput.value}`,
        `Disciplina: ${disciplineInput.value}`,
        '---'
    ].join('\n');

    fullText += metadata + '\n\n';

    document.querySelectorAll('.rev-content').forEach((revContent, index) => {
        const revTitle = document.querySelector(`.rev-tab[data-rev-id="${revContent.id}"]`).textContent;
        fullText += `//--- ${revTitle} ---//\n\n`;

        revContent.querySelectorAll('.aula-container').forEach(aulaEl => {
            if (!aulaEl.id.startsWith('aula-')) return;
            const state = getAulaState(aulaEl);
            fullText += `//--- ${state.title} ---//\n\n`;
            fullText += `${state.output || 'Nenhum resultado gerado.'}\n\n`;
        });
    });

    if (!fullText.trim()) {
        showModal({ title: 'Exportar', message: 'Nenhum conteúdo para exportar.', buttons: [{ text: 'OK', class: 'primary' }] });
        return;
    }

    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const projectName = projectNameInput.value.trim() || 'decupagem_formatada';
    a.download = `${projectName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

exportAllBtn.addEventListener('click', () => {
    preExportCheck(exportToTxt);
});

function exportToXLSX() {
    // 1. Validate required fields
    const requiredFields = {
        'Curso': courseInput.value,
        'Fase': phaseInput.value,
        'Disciplina': disciplineInput.value,
        'Responsável pelas notas': responsibleNotesInput.value
    };

    const emptyFields = Object.entries(requiredFields).filter(([_, value]) => !value.trim());
    if (emptyFields.length > 0) {
        const fieldNames = emptyFields.map(([name, _]) => name).join(', ');
        showModal({
            title: 'Campos Obrigatórios',
            message: `Por favor, preencha os seguintes campos antes de exportar para .xlsx: ${fieldNames}.`,
            buttons: [{ text: 'OK', class: 'primary' }]
        });
        return;
    }

    // 2. Prepare data for XLSX
    const ws_data = [
        ["Nome da Decupagem", projectNameInput.value],
        ["Curso", courseInput.value],
        ["Fase", phaseInput.value],
        ["Disciplina", disciplineInput.value],
        ["Responsável pelas notas", responsibleNotesInput.value],
        ["Responsável pela Edição", responsibleEditorInput.value],
        [] // Empty row for spacing
    ];

    const aulas = document.querySelectorAll('.aula-container');
    document.querySelectorAll('.rev-content').forEach((revContent) => {
        const revTitleEl = document.querySelector(`.rev-tab[data-rev-id="${revContent.id}"]`);
        const revTitle = revTitleEl ? revTitleEl.textContent : 'Revisão';

        const aulasInRev = revContent.querySelectorAll('.aula-container');
        if (aulasInRev.length > 0) {
            // Add Rev Title and Headers for each rev
            ws_data.push([revTitle]);
            ws_data.push(["Nome da Aula", "Entrada", "Saída", "Comentários"]);

            aulasInRev.forEach(aulaEl => {
                const title = getAulaState(aulaEl).title;
                const output = aulaEl.querySelector('.output-textarea').value;
                const lines = output.split('\n').filter(line => line.trim() !== '');

                lines.forEach(line => {
                    const parts = line.split('\t');
                    const entrada = parts[0] || '';
                    const saida = parts[1] || '';
                    const comentario = parts.slice(2).join('\t') || '';
                    ws_data.push([title, entrada, saida, comentario]);
                });
            });
            ws_data.push([]); // Empty row after each rev section
        }
    });

    // 3. Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Apply Styles
    const centerAlign = { horizontal: "center", vertical: "center" };
    const headerStyle = { font: { bold: true, sz: 14 }, fill: { fgColor: { rgb: "FFE3E3E3" } }, alignment: centerAlign };
    const revTitleStyle = { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: "FFABBADB" } }, alignment: centerAlign };
    const metaHeaderStyle = { font: { bold: true }, fill: { fgColor: { rgb: "FFDDDDDD" } } };

    // Style metadata headers
    for (let i = 0; i < 6; i++) {
        const cell_address = XLSX.utils.encode_cell({c:0, r:i});
        if(ws[cell_address]) ws[cell_address].s = metaHeaderStyle;
    }

    // Find and style Rev titles and column headers
    for(let r = 0; r < ws_data.length; r++) {
        // If row has only one cell, it's a rev title
        if(ws_data[r].length === 1 && ws_data[r][0].startsWith('Rev')) {
            const cell_address = XLSX.utils.encode_cell({c:0, r:r});
            if(ws[cell_address]) {
                ws[cell_address].s = revTitleStyle;
                // Merge cell for rev title
                if (!ws['!merges']) ws['!merges'] = [];
                ws['!merges'].push({ s: { r: r, c: 0 }, e: { r: r, c: 3 } });
            }
        }
        // If row's first cell is "Nome da Aula", it's a header row
        if(ws_data[r][0] === "Nome da Aula") {
            for(let c = 0; c < ws_data[r].length; c++) {
                const cell_address = XLSX.utils.encode_cell({c:c, r:r});
                if(ws[cell_address]) ws[cell_address].s = headerStyle;
            }
        }
    }

    // Auto-fit columns
    const colWidths = ws_data.reduce((acc, row) => {
        row.forEach((cell, i) => {
            const len = cell ? cell.toString().length : 0;
            if (!acc[i] || len > acc[i]) {
                acc[i] = len;
            }
        });
        return acc;
    }, []);
    ws['!cols'] = colWidths.map(w => ({ wch: w + 2 })); // Add a little padding


    XLSX.utils.book_append_sheet(wb, ws, "Decupagem");

    // 4. Generate filename and download
    const filename = `${courseInput.value.toUpperCase()}-FASE${phaseInput.value}-${disciplineInput.value.replace(/ /g, '_')}.xlsx`;
    XLSX.writeFile(wb, filename);
}

exportXlsxBtn.addEventListener('click', () => {
    preExportCheck(exportToXLSX);
});

// --- Project State Serialization ---
function getAppState() {
    return {
        projectName: projectNameInput.value,
        responsibleNotes: responsibleNotesInput.value,
        responsibleEditor: responsibleEditorInput.value,
        course: courseInput.value,
        phase: phaseInput.value,
        discipline: disciplineInput.value,
        globalPrompt: globalPromptTextarea.value,
        revs: Array.from(document.querySelectorAll('.rev-content')).map(revContent => {
            return {
                title: document.querySelector(`.rev-tab[data-rev-id="${revContent.id}"]`).textContent,
                aulas: Array.from(revContent.querySelectorAll('.aula-container')).map(getAulaState)
            }
        }),
        activeRev: document.querySelector('.rev-tab.active')?.dataset.revId || null
    };
}

function loadAppState(data) {
    projectNameInput.value = data.projectName || '';
    responsibleNotesInput.value = data.responsibleNotes || '';
    responsibleEditorInput.value = data.responsibleEditor || '';
    courseInput.value = data.course || '';
    phaseInput.value = data.phase || '';
    disciplineInput.value = data.discipline || '';
    globalPromptTextarea.value = data.globalPrompt || '';

    // Clear existing revs and aulas
    revTabsContainer.innerHTML = `<button id="add-rev-btn" title="Adicionar Revisão">+</button>`;
    // After recreating the button, re-query it and re-add its event listener
    addRevBtn = document.getElementById('add-rev-btn');
    addRevBtn.addEventListener('click', () => createRev());

    revContentsContainer.innerHTML = '';
    revCounter = 0;
    aulaCounter = 0;

    if (data.revs && data.revs.length > 0) {
        data.revs.forEach(revData => {
            // Pass the aulas data directly to createRev
            // This ensures aulas are created in the correct rev from the start.
            createRev(revData.title, revData.aulas);
        });
        // Activate the correct tab after all revs are created
        const activeRevId = data.activeRev || revTabsContainer.querySelector('.rev-tab')?.dataset.revId;
        if(activeRevId) {
            switchRev(activeRevId);
        } else if (revTabsContainer.querySelector('.rev-tab')) {
            // Fallback to the first rev if activeRevId is somehow invalid
            switchRev(revTabsContainer.querySelector('.rev-tab').dataset.revId);
        }

    } else if (data.aulas && data.aulas.length > 0) { // Legacy support for old format
        createRev("Rev 1", data.aulas); // Create default Rev 1 and pass aulas
    } else {
        createRev();
    }
}

// --- Local Storage Project Management ---
function saveProjectToLocal(projectName, isAutosave = false) {
    if (!projectName.trim()) {
        if (!isAutosave) { // Only show error for manual saves
            showModal({
                title: 'Erro ao Salvar',
                message: 'Por favor, insira um nome para a decupagem.',
                buttons: [{text: 'OK'}]
            });
        }
        return;
    }

    const appState = getAppState();
    const projects = JSON.parse(localStorage.getItem('markerboxProjects') || '{}');
    projects[projectName] = appState;
    localStorage.setItem('markerboxProjects', JSON.stringify(projects));
    populateLoadSelector();
    loadProjectSelect.value = projectName;

    if (!isAutosave) { // Only show success message for manual saves
        showModal({
            title: 'Sucesso!',
            message: `Decupagem "${projectName}" salva com sucesso no navegador!`,
            buttons: [{text: 'OK'}]
        });
    }
}

function loadProjectFromLocal(projectName) {
    const projects = JSON.parse(localStorage.getItem('markerboxProjects') || '{}');
    const projectData = projects[projectName];
    if (!projectData) return;
    loadAppState(projectData);
    if(autosaveIntervalId) startAutosave(); // Restart autosave for the new project
}

function deleteProjectFromLocal(projectName) {
    const projects = JSON.parse(localStorage.getItem('markerboxProjects') || '{}');
    delete projects[projectName];
    localStorage.setItem('markerboxProjects', JSON.stringify(projects));
    populateLoadSelector();
    projectNameInput.value = '';
    // Clear and reset to a single rev with one aula
    revTabsContainer.innerHTML = `<button id="add-rev-btn" title="Adicionar Revisão">+</button>`;
    revContentsContainer.innerHTML = '';
    revCounter = 0;
    aulaCounter = 0;
    // Reset prompt to default if it was deleted
    globalPromptTextarea.value = document.getElementById('global-prompt-textarea').defaultValue;
    createRev();
}

function populateLoadSelector() {
    const projects = JSON.parse(localStorage.getItem('markerboxProjects') || '{}');
    const projectNames = Object.keys(projects);
    const currentVal = loadProjectSelect.value;
    loadProjectSelect.innerHTML = '<option value="">Carregar Decupagem...</option>';
    projectNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        loadProjectSelect.appendChild(option);
    });
    loadProjectSelect.value = currentVal;
}

saveLocalBtn.addEventListener('click', () => {
    const projectName = projectNameInput.value.trim();
    if (projectName) {
        saveProjectToLocal(projectName);
    } else {
        showModal({
            title: 'Nome da Decupagem Necessário',
            message: 'Por favor, insira um nome para a decupagem no campo principal antes de salvar.',
            buttons: [
                { text: 'OK', class: 'primary' }
            ]
        });
    }
});

loadProjectSelect.addEventListener('change', (e) => {
    const projectName = e.target.value;
    if (projectName) {
        showModal({
            title: 'Carregar Decupagem',
            message: `Deseja carregar a decupagem "${projectName}"? As alterações não salvas serão perdidas.`,
            buttons: [
                { text: 'Cancelar', class: 'secondary', onClick: () => { loadProjectSelect.value = ''; } },
                { text: 'Carregar', class: 'primary', onClick: () => loadProjectFromLocal(projectName) }
            ]
        });
    }
});

deleteProjectBtn.addEventListener('click', () => {
    const projects = JSON.parse(localStorage.getItem('markerboxProjects') || '{}');
    const projectNames = Object.keys(projects);

    if (projectNames.length > 0) {
        const projectListHtml = `
            <style>
                .delete-project-list { list-style-type: none; padding: 0; margin: 10px 0 0 0; }
                .delete-project-list li { margin-bottom: 8px; }
                .delete-project-list label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
            </style>
            <ul class="delete-project-list">
                ${projectNames.map(name => `
                    <li>
                        <label>
                            <input type="checkbox" class="delete-project-checkbox" value="${name}">
                            <span>${name}</span>
                        </label>
                    </li>
                `).join('')}
            </ul>`;

        showModal({
            title: 'Excluir Decupagens',
            message: 'Selecione as decupagens que deseja excluir. Esta ação não pode ser desfeita.',
            customContent: projectListHtml,
            buttons: [
                { text: 'Cancelar', class: 'secondary' },
                {
                    text: 'Excluir Selecionadas',
                    class: 'danger',
                    onClick: () => {
                        const selectedCheckboxes = modalContent.querySelectorAll('.delete-project-checkbox:checked');
                        if (selectedCheckboxes.length === 0) {
                            // Re-open a simple info modal if nothing was selected
                            hideModal();
                            setTimeout(() => showModal({ title: 'Atenção', message: 'Nenhuma decupagem foi selecionada para exclusão.', buttons: [{ text: 'OK' }] }), 350);
                            return;
                        }

                        selectedCheckboxes.forEach(checkbox => {
                            deleteProjectFromLocal(checkbox.value);
                        });

                        hideModal();
                        setTimeout(() => {
                            showModal({ title: 'Sucesso', message: `${selectedCheckboxes.length} decupagem(ns) foram excluídas.`})
                        }, 350);
                    }
                }
            ]
        });
    } else {
        showModal({ title: 'Atenção', message: 'Não há decupagens salvas para excluir.', buttons: [{text: 'OK'}] });
    }
});

// --- File-based Project Management ---
downloadProjectBtn.addEventListener('click', () => {
    const projectName = projectNameInput.value.trim();
    if (!projectName) {
        showModal({
            title: 'Nome da Decupagem Necessário',
            message: 'Por favor, insira um nome para a decupagem no campo principal antes de baixar o arquivo do projeto.',
            buttons: [{ text: 'OK', class: 'primary' }]
        });
        return;
    }

    const appState = getAppState();
    const jsonString = JSON.stringify(appState, null, 2);
    const blob = new Blob([jsonString], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = projectName + '.json';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

uploadProjectBtn.addEventListener('click', () => projectFileInput.click());

projectFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            showModal({
                title: 'Carregar de Arquivo',
                message: `Deseja carregar a decupagem do arquivo "${file.name}"? As alterações não salvas serão perdidas.`,
                buttons: [
                    { text: 'Cancelar', class: 'secondary' },
                    { text: 'Carregar', class: 'primary', onClick: () => {
                            loadAppState(data);
                            loadProjectSelect.value = ''; // Unselect from dropdown
                            if(autosaveIntervalId) startAutosave(); // Restart autosave
                        }}
                ]
            });
        } catch (err) {
            console.error('Error parsing project file:', err);
            showModal({ title: 'Erro', message: 'O arquivo selecionado não é um arquivo de projeto válido.', buttons: [{text: 'OK'}] });
        }
    };
    reader.readAsText(file);
    e.target.value = null; // Reset input
});

// --- Text File Upload for Aulas ---

function parseFileInfo(content) {
    const aulaMatch = content.match(/AULA\s*(\d+)/i);
    const videoMatch = content.match(/V[ÍI]DEO\s*(\d+)/i);
    const parteMatch = content.match(/PARTE\s*(\d+)/i);
    return {
        aula: aulaMatch ? parseInt(aulaMatch[1], 10) : null,
        video: videoMatch ? parseInt(videoMatch[1], 10) : null,
        parte: parteMatch ? parseInt(parteMatch[1], 10) : null,
    };
}

function handleTextFiles(files) {
    if (files.length === 0) return;

    textFileInput.value = null;

    const textFiles = Array.from(files).filter(file => file.type === 'text/plain');
    const videoFiles = Array.from(files).filter(file => file.type.startsWith('video/'));

    const processTextFiles = (targetRevId) => {
        if (textFiles.length === 0) return;

        // Switch to the target rev before creating aulas
        if(targetRevId) switchRev(targetRevId);

        const filePromises = textFiles.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    const info = parseFileInfo(content);
                    resolve({
                        fileName: file.name.replace(/\.txt$/i, ''),
                        content: content,
                        ...info
                    });
                };
                reader.readAsText(file);
            });
        });

        Promise.all(filePromises).then(fileData => {
            const validFiles = fileData.filter(f => f !== null);
            const groupedAulas = {};
            const aulasToFormat = [];

            validFiles.forEach(file => {
                if (file.aula !== null && file.video !== null) {
                    const key = `aula-${file.aula}-video-${file.video}`;
                    if (!groupedAulas[key]) {
                        groupedAulas[key] = {
                            title: `Aula ${file.aula}.${file.video}`,
                            parts: []
                        };
                    }
                    groupedAulas[key].parts.push(file);
                } else {
                    if (document.querySelectorAll('.rev-content').length === 0) createRev();
                    const newAula = createAula({
                        title: file.fileName,
                        inputs: [file.content],
                        collapsed: false,
                        inlineMode: true // Default to inline mode
                    });
                    aulasToFormat.push(newAula);
                }
            });

            Object.values(groupedAulas).forEach(group => {
                group.parts.sort((a, b) => (a.parte || a.fileName) - (b.parte || b.fileName));
                const inputs = group.parts.map(p => p.content);
                if (group.parts.length > 1) {
                    group.title += ` (Partes 1-${group.parts.length})`;
                }
                if (document.querySelectorAll('.rev-content').length === 0) createRev();
                const newAula = createAula({
                    title: group.title,
                    inputs: inputs,
                    collapsed: false,
                    inlineMode: true // Default to inline mode
                });
                aulasToFormat.push(newAula);
            });

            if (aulasToFormat.length > 0) {
                showModal({
                    title: "Processando...",
                    message: `Formatando ${aulasToFormat.length} aula(s) a partir dos arquivos de texto...`,
                    buttons: []
                });
                const formatPromises = aulasToFormat.map(aulaEl => formatAula(aulaEl));
                Promise.all(formatPromises).then(() => {
                    setTimeout(() => {
                        hideModal();
                        setTimeout(() => {
                            showModal({title: "Sucesso", message: "Aulas criadas e formatadas com sucesso!", buttons:[{text: 'OK'}]})
                        }, 350);
                    }, 500);
                });
            }
        });
    };

    if (videoFiles.length > 0) {
        // If there are video files, show the selection modal first.
        // The callback will then handle creating video aulas and processing text aulas.
        handleVideoFiles(videoFiles, (targetRevId) => {
            if (targetRevId) {
                processTextFiles(targetRevId);
            }
        });
    } else if (textFiles.length > 0) {
        // If only text files, process them in the currently active rev.
        const activeRevId = document.querySelector('.rev-tab.active')?.dataset.revId;
        processTextFiles(activeRevId);
    }
}

function handleVideoFiles(videoFiles, onComplete) {
    const revTabs = Array.from(revTabsContainer.querySelectorAll('.rev-tab'));
    const revOptions = revTabs.map(tab => {
        const revId = tab.dataset.revId;
        const title = tab.querySelector('.rev-tab-title').textContent;
        return `<option value="${revId}">${title}</option>`;
    }).join('');

    const fileListHTML = videoFiles.map(f => `<li>${f.name}</li>`).join('');

    const modalHTML = `
        <div id="video-import-options">
            <p>Os seguintes arquivos de vídeo serão adicionados como novas aulas:</p>
            <ul style="max-height: 150px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px;">${fileListHTML}</ul>
            <p style="margin-top: 1rem;">Selecione onde adicionar as aulas:</p>
            <select id="rev-select-video-import">
                ${revOptions}
                <option value="new-rev">-- Criar Nova Revisão --</option>
            </select>
            <input type="text" id="new-rev-name-import" placeholder="Nome da nova revisão" style="display: none; margin-top: 0.5rem; width: 100%; box-sizing: border-box;" />
        </div>
    `;

    showModal({
        title: "Importar Aulas de Vídeos",
        customContent: modalHTML,
        buttons: [
            { text: "Cancelar", class: "secondary" },
            {
                text: "Adicionar Aulas",
                class: "primary",
                onClick: () => {
                    const revSelect = document.getElementById('rev-select-video-import');
                    let targetRevId = revSelect.value;

                    if (targetRevId === 'new-rev') {
                        const newRevNameInput = document.getElementById('new-rev-name-import');
                        const newRevName = newRevNameInput.value.trim();
                        if (!newRevName) {
                            newRevNameInput.style.borderColor = 'var(--danger-color)';
                            newRevNameInput.focus();
                            // Shake animation for feedback
                            newRevNameInput.classList.add('input-error-shake');
                            setTimeout(() => newRevNameInput.classList.remove('input-error-shake'), 500);
                            return; // Don't close modal, show error
                        }
                        const newRev = createRev(newRevName);
                        targetRevId = newRev.content.id;
                    }

                    switchRev(targetRevId);

                    videoFiles.forEach(file => {
                        // remove extension for title
                        const title = file.name.split('.').slice(0, -1).join('.');
                        createAula({ title: title, collapsed: false, inlineMode: true }); // Default to inline mode
                    });

                    hideModal();

                    // Use a timeout to allow the modal to close before showing the next one
                    setTimeout(() => {
                        // Callback to continue processing text files, if any
                        if (onComplete) {
                            onComplete(targetRevId);
                        } else {
                            // If there's no callback, it means only videos were uploaded. Show success.
                            showModal({ title: "Sucesso", message: `${videoFiles.length} aulas foram criadas.`, buttons: [{text: 'OK'}] });
                        }
                    }, 350);
                }
            }
        ]
    });

    // Add logic to show/hide new rev name input
    const revSelect = document.getElementById('rev-select-video-import');
    const newRevNameInput = document.getElementById('new-rev-name-import');
    revSelect.addEventListener('change', () => {
        newRevNameInput.style.display = revSelect.value === 'new-rev' ? 'block' : 'none';
        if(revSelect.value === 'new-rev') newRevNameInput.focus();
    });
}

fileDropZone.addEventListener('click', () => textFileInput.click());
fileDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropZone.classList.add('dragover');
});
fileDropZone.addEventListener('dragleave', () => fileDropZone.classList.remove('dragover'));
fileDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropZone.classList.remove('dragover');
    handleTextFiles(e.dataTransfer.files);
});
textFileInput.addEventListener('change', (e) => handleTextFiles(e.target.files));

// --- Info Pages Logic ---
function showInfoPage(type) {
    const pageContent = document.createElement('div');
    pageContent.id = 'info-page-content';
    pageContent.className = 'info-page-content';

    const title = type === 'instructions' ? 'Instruções de Uso' : 'Sobre a Ferramenta (Background)';
    const content = type === 'instructions' ? `
        <h2>Visão Geral</h2>
        <p>Esta ferramenta foi criada para agilizar a formatação de textos de decupagem (transcrições com marcações de tempo) para a plataforma Markerbox, utilizando IA para interpretar e corrigir os textos de forma inteligente. O objetivo é transformar textos brutos, muitas vezes com anotações e formatos inconsistentes, em um arquivo de texto limpo e estruturado que o Markerbox possa importar diretamente.</p>

        <h2>Interface da Aplicação</h2>
        <p>A tela principal é dividida em áreas-chave, organizadas para um fluxo de trabalho lógico:</p>
        <ol>
            <li><b>Cabeçalho do Projeto:</b> No topo, você encontra o título "Formatador de Decupagens Markerbox", um campo para nomear seu projeto, e os controles para salvar, baixar, carregar e excluir decupagens.</li>
            <li><b>Ações Globais e Prompt Geral:</b> Logo abaixo, ficam os botões para "Adicionar Aula" e "Exportar Tudo", seguido pelo painel "Prompt Geral", que contém as regras que a IA usa para a formatação.</li>
            <li><b>Criação Automática de Aulas:</b> A área "Arraste e solte arquivos" é um atalho poderoso para criar "Aulas" a partir de seus arquivos de decupagem <code>.txt</code>.</li>
            <li><b>Container de Aulas:</b> A área principal onde os blocos de trabalho, chamados "Aulas", são listados e gerenciados. Cada "Aula" representa um vídeo ou um conjunto de vídeos a serem formatados.</li>
        </ol>

        <h2>Passo a Passo Detalhado</h2>
        <p>Siga estes passos para utilizar a ferramenta de forma eficaz.</p>
        
        <h3>1. Nomear e Gerenciar o Projeto</h3>
        <ul>
            <li><b>Nome da Decupagem e Metadados:</b> Comece inserindo um nome no campo "Nome da Decupagem..." e preenchendo os campos de metadados ("Responsável pelas notas", "Curso", "Fase", "Disciplina"). Estes dados são essenciais para a exportação e organização.</li>
            <li>
                <b>Controles do Projeto (Ícones e Botões):</b>
                <ul>
                    <li><img src="save-icon.png" alt="Salvar" class="inline-icon"> <b>Salvar no Navegador (<code>Alt+S</code>):</b> Salva todo seu trabalho (nome, prompt, aulas, textos) no armazenamento local do seu navegador. O trabalho fica disponível mesmo após fechar a aba ou reiniciar o computador. Se o projeto não tiver nome, uma janela pedirá para você nomeá-lo.</li>
                    <li><img src="download-icon.png" alt="Baixar" class="inline-icon"> <b>Baixar Arquivo .json (<code>Ctrl+Alt+J</code>):</b> Baixa um arquivo <code>.json</code> contendo todo o estado da sua decupagem. É a forma ideal de fazer backup ou compartilhar o projeto com outras pessoas que usam a mesma ferramenta.</li>
                    <li><b>Menu "Carregar Decupagem...":</b> Lista todas as decupagens salvas no seu navegador, permitindo carregá-las rapidamente com um clique (após confirmação).</li>
                    <li><img src="upload-icon.png" alt="Carregar" class="inline-icon"> <b>Carregar Arquivo .json (<code>Alt+J</code>):</b> Abre um seletor de arquivos para carregar um projeto <code>.json</code> previamente salvo. Esta ação substituirá o conteúdo atual.</li>
                    <li><b class="danger">Botão Excluir:</b> Abre uma janela para selecionar e remover uma ou mais decupagens salvas no armazenamento do seu navegador. Esta ação é permanente.</li>
                </ul>
            </li>
        </ul>

        <h3>2. Configurar o Prompt Geral</h3>
        <p>O painel <strong>"Prompt Geral"</strong> (inicialmente minimizado, clique no título ou no ícone ► para expandir) é o cérebro da formatação. Ele contém as instruções detalhadas que a IA segue para transformar seu texto. O prompt padrão é otimizado para a maioria dos casos de decupagem. Você pode editar este prompt para necessidades específicas. As alterações no prompt são salvas junto com o projeto. Este campo também pode ser redimensionado verticalmente arrastando a alça na parte inferior central.</p>

        <h3>3. Adicionar Conteúdo (Revisões e Aulas)</h3>
        <p>A aplicação agora organiza o trabalho em <strong>Revisões (Revs)</strong>, que funcionam como abas. Cada Rev contém seu próprio conjunto de Aulas.</p>
        <ul>
            <li><b>Gerenciar Revisões:</b> Use as abas (ex: "Rev 1", "Rev 2") para alternar entre diferentes conjuntos de aulas. Clique no botão <span class="inline-icon-text">+</span> ao lado das abas ou use o atalho <code>Alt+R</code> para adicionar uma nova revisão.</li>
            <li><b>Adicionar Aulas:</b> Com uma aba de revisão ativa, você pode adicionar conteúdo de duas maneiras:
                <ul>
                    <li><b>Automaticamente (Recomendado):</b> Arraste arquivos <code>.txt</code> para a área designada ou clique nela (Atalho: <code>Alt+O</code>) para selecioná-los. A aplicação irá:
                        <ol>
                            <li>Ler o conteúdo de cada arquivo.</li>
                            <li>Procurar por padrões como "AULA #", "VÍDEO #" e "PARTE #" nos textos.</li>
                            <li>Criar e nomear "Aulas" automaticamente na revisão ativa (ex: "Aula 1.2").</li>
                            <li>Agrupar arquivos que são diferentes "Partes" do mesmo vídeo na mesma "Aula", na ordem correta.</li>
                            <li><strong>Iniciar a formatação de todas as aulas recém-criadas automaticamente.</strong> Você verá os resultados aparecerem nos campos "Output" de cada nova aula.</li>
                        </ol>
                    </li>
                    <li><b>Manualmente:</b> Clique no botão <strong>"Adicionar Aula"</strong> para criar um novo bloco de trabalho vazio na revisão atual. A aplicação criará a nova aula com uma numeração inteligente. Você precisará colar o texto manualmente no campo de input.</li>
                     <li><b>A partir de Arquivos de Vídeo:</b> Você também pode arrastar arquivos de vídeo (<code>.mp4</code>, <code>.mov</code>, etc.) para a área de upload. Uma janela aparecerá, permitindo que você escolha em qual revisão (existente ou uma nova) deseja criar as aulas. A ferramenta então criará uma "Aula" vazia para cada arquivo de vídeo, usando o nome do arquivo como título. Isso é útil para montar a estrutura do seu projeto rapidamente.</li>
                </ul>
            </li>
        </ul>
        
        <h3>4. Trabalhar com uma "Aula"</h3>
        <p>Cada bloco de "Aula" é um componente autocontido com os seguintes controles:</p>
        <ul>
            <li><span class="inline-icon-text">::</span> <b>Alça de Arraste:</b> Clique e arraste para reordenar as aulas na lista.</li>
            <li><b>Título da Aula:</b> É editável. Clique no texto para renomear. <strong>A ferramenta também tentará atualizar o título automaticamente</strong> com base em "Aula #" e "Vídeo #" encontrados no seu texto quando você clica em "Formatar".</li>
            <li><span class="inline-icon-text">▼/►</span> <b>Minimizar/Expandir:</b> Oculta ou exibe o conteúdo da aula para manter a área de trabalho organizada.</li>
            <li><span class="inline-icon-text">&times;</span> <b>Remover Aula:</b> Exclui o bloco da aula (pede confirmação).</li>
            <li><b>Input (Texto Original):</b> A área para colar ou editar o texto a ser formatado. Os campos de Input, o Prompt Geral e o Output podem ser redimensionados verticalmente. Para isso, clique e arraste a alça cinza que aparece na base de cada área de texto. A aplicação agora <strong>preserva o conteúdo dos inputs</strong> ao alternar entre o modo de texto livre e o "Modo em Linha".
                <ul>
                    <li><b>Vídeo em várias partes:</b> Marque esta caixa se o seu vídeo estiver dividido em múltiplos arquivos. No modo tradicional, use os botões <code>+</code> e <code>&times;</code> para adicionar ou remover campos de input para cada parte. No modo em linha, esta opção criará seções separadas para cada parte do vídeo, com seus próprios controles de linhas.</li>
                    <li><b>Modo em Linha:</b> Esta opção transforma a área de input em um formato estruturado com três campos por linha: "Entrada", "Saída" e "Comentários". Este modo é ideal para ajustes finos ou para criar marcações do zero e vem ativado por padrão em novas aulas.
                        <ul>
                            <li>Cada linha representa uma marcação completa.</li>
                            <li>Os campos "Entrada" e "Saída" aceitam apenas valores de tempo no formato HH:MM:SS com formatação automática.</li>
                            <li>O campo "Comentários" é opcional e pode conter qualquer texto descritivo.</li>
                            <li>Nos campos de comentário, você pode usar os botões 💾 para salvar um comentário como "frequente" e 📋 para abrir um menu pop-up (que aparecerá logo acima do botão) e selecionar um comentário salvo anteriormente.</li>
                            <li>Use os botões <code>+ Marcação</code> e <code>&times; Marcação</code> para adicionar ou remover linhas de marcação.</li>
                            <li>Linhas com campos de tempo vazios são ignoradas na formatação.</li>
                            <li>Todas as linhas devem ter ambos os campos de tempo (Entrada e Saída) preenchidos para serem válidas.</li>
                            <li>Se "Vídeo em várias partes" estiver ativo, cada parte terá sua própria seção com controles independentes de linhas.</li>
                        </ul>
                    </li>
                </ul>
            </li>
            <li><b>Botão "Formatar":</b> Envia o texto do(s) input(s) da aula atual e o Prompt Geral para a IA e exibe o resultado abaixo. O botão fica desabilitado durante o processo.</li>
            <li><b>Botão "Limpar":</b> Apaga os campos de Input e Output da aula.</li>
            <li><b>Botão "Exportar Aula":</b> Baixa o conteúdo do campo "Output" como um arquivo <code>.txt</code> individual.</li>
            <li><b>Output (Resultado):</b> Exibe o texto formatado pela IA. É um campo somente leitura.
                <ul>
                    <li><b class="inline-icon-text">Marcações</b>: Um contador que aparece acima do output, mostrando o número de linhas de marcação (com tempo de entrada/saída) geradas.</li>
                    <li><b>Botão "Copiar":</b> Aparece acima do output após a formatação, permitindo copiar o resultado para a área de transferência com um único clique.</li>
                </ul>
            </li>
        </ul>

        <h3>5. Ações Globais e Exportação</h3>
        <p>Os botões localizados acima da área de revisões oferecem controle sobre todo o projeto.</p>
        <ul>
           <li><b>Botão "Formatar Tudo" (<code>Alt+F</code>):</b> Inicia o processo de formatação para <strong>todas as aulas em todas as revisões</strong>. Uma janela de progresso será exibida.</li>
           <li><b>Botão "Exportar Tudo para .txt" (<code>Alt+T</code>):</b> Baixa um único arquivo de texto contendo os outputs de todas as suas aulas, organizadas por revisão. A aplicação exigirá que os campos de metadados ("Curso", "Fase", etc.) estejam preenchidos e nomeará o arquivo automaticamente (ex: <code>CURSO-FASE3-NOME_DA_DISCIPLINA.txt</code>).</li>
           <li><b>Botão "Exportar Tudo para .xlsx" (<code>Alt+X</code>):</b> Gera um arquivo Excel com todos os dados. O arquivo é estilizado com cores e negrito para melhor visualização e também organiza os dados por revisão. Esta opção também requer que os metadados sejam preenchidos.</li>
           <li><b>Verificação Pré-Exportação:</b> Antes de exportar, a ferramenta verificará se todas as aulas já foram formatadas. Se não, ela oferecerá a opção de formatar tudo automaticamente antes de prosseguir com a exportação. Durante esta formatação em lote, uma barra de progresso indicará quantas aulas já foram processadas.</li>
        </ul>

        <h3>6. Opções da Aplicação (Aba "Opções")</h3>
        <p>A aba "Opções" no cabeçalho abre um modal com configurações para personalizar sua experiência:</p>
        <ul>
           <li><b>Iniciar sempre a partir de um modelo:</b> Permite que você escolha uma de suas decupagens salvas para ser carregada automaticamente toda vez que você abrir a aplicação.</li>
           <li><b>Tema da Aplicação:</b> Alterne entre os temas "Escuro" (padrão) e "Claro".</li>
           <li><b>Salvamento Automático:</b> Se habilitado, a aplicação salvará automaticamente a decupagem atual (se tiver um nome) em intervalos de 2, 5 ou 10 minutos.</li>
           <li><b>Atalhos de Teclado:</b> Permite visualizar todos os atalhos disponíveis e configurar os textos para os atalhos rápidos de comentários (<code>Alt+[número]</code>).</li>
           <li><b>Modo Mobile (Experimental):</b> Um seletor para ativar um layout otimizado para telas menores, facilitando o uso em dispositivos móveis.</li>
        </ul>

    ` : `
        <h2>Arquitetura e Conceitos</h2>
        <p>O <strong>Formatador de Decupagens Markerbox</strong> é uma Single-Page Application (SPA) que opera inteiramente no navegador do cliente (client-side), sem a necessidade de um servidor backend para suas funções principais. Isso garante privacidade (seus dados não saem do seu computador para um servidor de terceiros) e performance.</p>
        
        <h3>Tecnologias Fundamentais</h3>
        <ul>
            <li><strong>HTML5, CSS3, JavaScript (ESM):</strong> A aplicação é construída com tecnologias web padrão. O uso de Módulos ES (ECMAScript Modules) permite uma organização de código limpa e modular, carregado diretamente no navegador sem a necessidade de um empacotador (bundler).</li>
            <li><strong>IA Generativa (<llm-calls>):</strong> O núcleo da funcionalidade de formatação é potencializado por um Modelo de Linguagem de ponta. A aplicação constrói um prompt combinando as instruções do "Prompt Geral" com o texto de entrada do usuário e o envia para a API para processamento.</li>
            <li><strong>Web Storage API (LocalStorage):</strong> Utilizada para a funcionalidade de "Salvar no navegador" e para as "Opções". Permite que o estado completo da aplicação (projetos, aulas, textos, configurações) seja serializado como JSON e armazenado de forma persistente no navegador do usuário.</li>
            <li><strong>File API & Blob:</strong> Estas APIs do navegador são usadas para ler arquivos <code>.txt</code> (decaps) e <code>.json</code> (projetos) carregados pelo usuário e para gerar arquivos para download.</li>
            <li><strong>html2pdf.js:</strong> Uma biblioteca de terceiros usada para converter o conteúdo HTML das janelas de "Instruções" e "Sobre" em documentos PDF para download, preservando o estilo.</li>
        </ul>

        <h2>Lógica de Funcionamento Detalhada</h2>
        
        <h3>Gerenciamento de Estado</h3>
        <p>A aplicação mantém um "estado" central, que é um grande objeto JavaScript contendo tudo o que é necessário para reconstruir a interface a qualquer momento. Este objeto inclui:</p>
        <ul>
            <li><code>projectName</code> e outros metadados.</li>
            <li><code>globalPrompt</code>: O conteúdo do campo "Prompt Geral".</li>
            <li><code>revs</code>: Um array de objetos de "Revisão", onde cada um contém seu título e um array de <code>aulas</code>. Cada objeto de aula contém seu título, estado (colapsado ou não), e, crucialmente, os dados para <strong>ambos</strong> os modos de input (texto e linha), garantindo que nenhuma informação seja perdida ao alternar a visualização.</li>
            <li><code>activeRev</code>: O ID da revisão atualmente selecionada.</li>
        </ul>
        <p>Um segundo objeto no LocalStorage armazena as configurações do usuário da aba "Opções", como tema e preferências de inicialização. O estado da aplicação é a "fonte da verdade". A função <code>getAppState()</code> percorre a página e coleta esses dados da UI, e a <code>loadAppState()</code> faz o inverso: recebe um objeto de estado e popula a UI com os dados. Isso é crucial para as funções de salvar e carregar.</p>

        <h3>Estrutura de Componentes (Revisões e Aulas)</h3>
        <p>A interface é construída dinamicamente. As <strong>Revisões</strong> são gerenciadas por um conjunto de funções que criam abas e painéis de conteúdo. Dentro do painel de conteúdo de uma revisão ativa, as <strong>Aulas</strong> são adicionadas. As "Aulas" não são codificadas diretamente em HTML. Em vez disso, existe um único elemento <code>&lt;template&gt;</code> no HTML que serve como um molde. Quando o usuário clica em "Adicionar Aula" (ou quando arquivos são carregados), a função <code>createAula()</code>:</p>
        <ol>
            <li>Clona o conteúdo do template.</li>
            <li>Atribui IDs únicos aos elementos internos para garantir que os controles funcionem de forma independente (ex: checkboxes, botões).</li>
            <li><strong>Executa uma lógica de numeração inteligente:</strong> antes de nomear uma nova "Aula", a função verifica os números de todas as aulas existentes, encontra a primeira lacuna na sequência (ex: se "Aula 0" e "Aula 2" existem, a nova será "Aula 1"), e nomeia a nova aula de acordo. Se não houver lacunas, ela adiciona a próxima aula ao final da sequência.</li>
            <li>Popula o clone com dados existentes (se estiver carregando um projeto) ou deixa-o como um novo item.</li>
            <li>Anexa o novo elemento ao DOM, tornando-o visível e interativo.</li>
        </ol>
        <p>Esta abordagem é muito mais eficiente e escalável do que manipular strings de HTML gigantes.</p>

        <h3>Processamento de Arquivos</h3>
        <p>Quando arquivos são carregados (via arrastar e soltar ou clique), a função <code>handleTextFiles</code> orquestra um processo assíncrono:</p>
        <ol>
            <li>Ela separa os arquivos por tipo: <code>text/plain</code> e <code>video/*</code>.</li>
            <li><strong>Para arquivos de texto (.txt):</strong> Ela utiliza a <code>FileReader</code> API para ler o conteúdo de cada arquivo. Para cada um, a função <code>parseFileInfo</code> usa Expressões Regulares (RegEx) para buscar padrões de nomenclatura como <code>/AULA\\s*(\\d+)/i</code>, etc. Os arquivos são então agrupados em um objeto JavaScript, permitindo que todas as "partes" de um mesmo vídeo sejam reunidas. Finalmente, a aplicação itera sobre os grupos para criar as "Aulas" na UI e chama <code>formatAula()</code> para cada uma, automatizando todo o fluxo de trabalho.</li>
            <li><strong>Para arquivos de vídeo:</strong> Uma função separada, <code>handleVideoFiles</code>, é chamada. Ela não lê o conteúdo do vídeo. Em vez disso, ela abre um modal que lista os nomes dos arquivos de vídeo e pede ao usuário para selecionar uma revisão (ou criar uma nova). Após a confirmação, a aplicação cria "Aulas" vazias, usando os nomes dos arquivos como títulos, permitindo que o usuário prepare a estrutura do projeto.</li>
        </ol>

        <h3>Interação com a IA</h3>
        <p>A função <code>formatAula</code> é o ponto de contato com a IA:</p>
        <ol>
            <li>Ela coleta o texto dos inputs da aula, respeitando o modo ativo ("Modo em Linha" ou texto).</li>
            <li><strong>Atualização de Título:</strong> Antes de enviar para a IA, a função usa RegEx para procurar por "Aula #" e "Vídeo #" no texto de entrada e atualiza o título da aula na UI se encontrar correspondências.</li>
            <li>Constrói uma mensagem de sistema, instruindo a IA a se comportar como um formatador e a usar tabulações reais <code>\\t</code>.</li>
            <li>Constrói uma mensagem de usuário, que inclui as instruções do "Prompt Geral" e o texto de entrada combinado.</li>
            <li>Este conjunto de mensagens é enviado para o endpoint da API da Websim.</li>
            <li>A resposta da IA é então inserida no campo "Output" da respectiva aula, e o contador de "Marcações" é atualizado.</li>
        </ol>

        <h3>Sistema de Janela Modal</h3>
        <p>A aplicação usa um único conjunto de elementos HTML para todas as janelas pop-up. A função <code>showModal(config)</code> recebe um objeto de configuração que define dinamicamente o título, a mensagem, os botões e o conteúdo personalizado. Por exemplo, para a exclusão de projetos, um trecho de HTML com uma lista de checkboxes é injetado como conteúdo personalizado. Para janelas de confirmação simples, apenas a mensagem e os botões são definidos. Isso evita a duplicação de código e mantém a consistência da interface.</p>
    `;

    pageContent.innerHTML = `<h3 class="modal-pdf-title">${title}</h3>${content}`;

    showModal({
        title: '',
        message: '',
        customContent: pageContent,
        buttons: [
            { text: 'Fechar', class: 'secondary' },
            {
                text: 'Baixar como PDF',
                class: 'primary',
                onClick: () => {
                    const textColor = '#000000'; // Dark text
                    const mutedColor = '#555555';
                    const primaryColor = '#6a5acd';
                    const borderColor = '#cccccc';
                    const codeBg = '#f0f0f5';
                    const codeColor = '#000000';

                    // Create a style element to inject into the PDF content for better styling control
                    const pdfStyles = `
                        body { color: ${mutedColor}; font-family: sans-serif; line-height: 1.6; background-color: #ffffff; }
                        h2, h3, strong { color: ${textColor}; }
                        h2 { border-bottom: 1px solid ${borderColor}; padding-bottom: 0.5rem; margin-top: 1.5rem; }
                        h3 { color: ${primaryColor}; }
                        .modal-pdf-title { text-shadow: none; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid ${borderColor}; color: ${textColor}; }
                        code { background-color: ${codeBg}; padding: 2px 5px; border-radius: 4px; border: 1px solid ${borderColor}; font-family: monospace; color: ${codeColor}; }
                        ul, ol { padding-left: 20px; }
                        li, p, h2, h3 { page-break-inside: avoid; }
                        .inline-icon { display: inline-block; vertical-align: middle; width: 16px; height: 16px; margin: 0 4px; }
                        .inline-icon-text { display: inline-block; vertical-align: middle; font-family: monospace; font-weight: bold; color: ${textColor}; background-color: ${codeBg}; padding: 0px 6px; border-radius: 4px; border: 1px solid ${borderColor}; margin: 0 4px; }
                        .danger { color: #c92a3a; }
                     `;

                    const elementToPrint = pageContent.cloneNode(true);
                    const blankPage = document.createElement('div');
                    blankPage.style.pageBreakBefore = 'always';
                    elementToPrint.appendChild(blankPage);

                    const filename = type === 'instructions' ? 'instrucoes-FormatadorMarkerbox.pdf' : 'sobre-FormatadorMarkerbox.pdf';

                    html2pdf().from(elementToPrint).set({
                        margin: 15,
                        filename: filename,
                        pagebreak: { mode: ['css', 'avoid-all'] },
                        html2canvas: {
                            scale: 2, // Improve quality
                            useCORS: true,
                            backgroundColor: '#ffffff', // Explicitly set white background for PDF
                            onclone: (clonedDoc) => {
                                const styleTag = clonedDoc.createElement('style');
                                styleTag.innerHTML = pdfStyles;
                                clonedDoc.head.appendChild(styleTag);
                                // Ensure the content is not constrained in height for PDF generation
                                const contentEl = clonedDoc.querySelector('.info-page-content');
                                if (contentEl) {
                                    contentEl.style.maxHeight = 'none';
                                    contentEl.style.overflow = 'visible';
                                }
                                // Ensure icons are visible on light background by inverting them
                                Array.from(clonedDoc.querySelectorAll('.inline-icon')).forEach(img => {
                                    img.style.filter = ''; // Remove filter for light bg
                                });
                            }
                        },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    }).save().then(() => {
                        hideModal(); // Close modal after saving
                    });
                }
            }
        ]
    });
}

instructionsTab.addEventListener('click', (e) => {
    e.preventDefault();
    showInfoPage('instructions');
});

backgroundTab.addEventListener('click', (e) => {
    e.preventDefault();
    showInfoPage('background');
});

// --- Frequent Comments ---
function saveFrequentComments() {
    localStorage.setItem('markerboxFrequentComments', JSON.stringify(frequentComments));
}

function loadFrequentComments() {
    frequentComments = JSON.parse(localStorage.getItem('markerboxFrequentComments') || '[]');
}

function showFrequentCommentsPopup(targetInput) {
    // Remove any existing popup
    const existingPopup = document.getElementById('frequent-comments-popup');
    if (existingPopup) existingPopup.remove();

    if (frequentComments.length === 0) {
        // Don't show modal, just do nothing if list is empty
        return;
    }

    const popup = document.createElement('ul');
    popup.id = 'frequent-comments-popup';

    frequentComments.forEach(comment => {
        const item = document.createElement('li');
        const textSpan = document.createElement('span');
        textSpan.textContent = comment;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-comment-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Excluir comentário';

        item.appendChild(textSpan);
        item.appendChild(deleteBtn);

        textSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            targetInput.value = comment;
            popup.remove();
            targetInput.focus();
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            frequentComments = frequentComments.filter(c => c !== comment);
            saveFrequentComments();
            item.remove(); // Remove from popup UI
            if (frequentComments.length === 0) {
                popup.remove();
            }
        });

        popup.appendChild(item);
    });

    document.body.appendChild(popup);
    const rect = targetInput.getBoundingClientRect();
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 5}px`; // Position below the input

    // Click outside to close is handled by the input's blur event
}

// --- Options Logic ---
function showOptionsModal() {
    const projects = JSON.parse(localStorage.getItem('markerboxProjects') || '{}');
    const projectNames = Object.keys(projects);

    const optionsContent = `
        <div class="options-container">
            <div class="option-item">
                <label for="startup-project-enabled">
                    <input type="checkbox" id="startup-project-enabled">
                    Iniciar sempre a partir de um modelo
                </label>
                <select id="startup-project-select" disabled>
                    <option value="">Nenhum</option>
                    ${projectNames.map(name => `<option value="${name}">${name}</option>`).join('')}
                </select>
            </div>
            <div class="option-item">
                <div class="option-label">Tema da Aplicação</div>
                <div class="theme-switcher">
                     <button data-theme="dark">Escuro</button>
                     <button data-theme="light">Claro</button>
                </div>
            </div>
            <div class="option-item">
                <label for="autosave-enabled">
                     <input type="checkbox" id="autosave-enabled">
                     Salvamento Automático
                </label>
                <select id="autosave-interval" disabled>
                    <option value="120000">a cada 2 minutos</option>
                    <option value="300000">a cada 5 minutos</option>
                    <option value="600000">a cada 10 minutos</option>
                </select>
            </div>
            <div class="option-item">
                <label class="option-label">Atalhos de Teclado</label>
                <button id="configure-shortcuts-btn" class="secondary" style="align-self: flex-start; font-weight: normal; padding: 6px 12px;">Configurar Atalhos</button>
            </div>
            <div class="option-item">
                <label class="option-label">Modo Mobile (Experimental)</label>
                <div class="switch-container">
                    <label class="switch">
                        <input type="checkbox" id="mobile-mode-toggle">
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>
        </div>
    `;

    showModal({
        title: 'Opções',
        customContent: optionsContent,
        buttons: [{ text: 'Fechar', class: 'secondary' }]
    });

    // --- Populate and bind options ---
    const startupEnabled = modalContainer.querySelector('#startup-project-enabled');
    const startupSelect = modalContainer.querySelector('#startup-project-select');
    startupEnabled.checked = settings.startupProjectEnabled || false;
    startupSelect.disabled = !startupEnabled.checked;
    startupSelect.value = settings.startupProject || '';
    startupEnabled.addEventListener('change', (e) => {
        settings.startupProjectEnabled = e.target.checked;
        startupSelect.disabled = !e.target.checked;
        saveSettings();
    });
    startupSelect.addEventListener('change', (e) => {
        settings.startupProject = e.target.value;
        saveSettings();
    });

    const themeSwitcher = modalContainer.querySelector('.theme-switcher');
    themeSwitcher.querySelector(`[data-theme="${settings.theme || 'dark'}"]`).classList.add('active');
    themeSwitcher.addEventListener('click', (e) => {
        if(e.target.tagName === 'BUTTON') {
            const newTheme = e.target.dataset.theme;
            settings.theme = newTheme;
            applyTheme();
            saveSettings();
            themeSwitcher.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
        }
    });

    const autosaveEnabled = modalContainer.querySelector('#autosave-enabled');
    const autosaveInterval = modalContainer.querySelector('#autosave-interval');
    autosaveEnabled.checked = settings.autosaveEnabled || false;
    autosaveInterval.disabled = !autosaveEnabled.checked;
    autosaveInterval.value = settings.autosaveInterval || '300000';
    autosaveEnabled.addEventListener('change', (e) => {
        settings.autosaveEnabled = e.target.checked;
        autosaveInterval.disabled = !e.target.checked;
        startAutosave();
        saveSettings();
    });
    autosaveInterval.addEventListener('change', (e) => {
        settings.autosaveInterval = e.target.value;
        startAutosave();
        saveSettings();
    });

    // Mobile mode is just a UI toggle for now
    const mobileToggle = modalContainer.querySelector('#mobile-mode-toggle');
    mobileToggle.checked = document.body.classList.contains('mobile-mode');
    mobileToggle.addEventListener('change', (e) => {
        document.body.classList.toggle('mobile-mode', e.target.checked);
    });

    modalContainer.querySelector('#configure-shortcuts-btn').addEventListener('click', showShortcutsModal);
}

function showShortcutsModal() {
    const shortcuts = keyShortcuts;
    let shortcutsHTML = '<div id="shortcuts-list">';

    for (const key in shortcuts) {
        if (shortcuts.hasOwnProperty(key)) {
            const shortcut = shortcuts[key];
            shortcutsHTML += `
                <div class="shortcut-item">
                    <div class="shortcut-keys">${shortcut.display}</div>
                    <div class="shortcut-desc">
                        ${shortcut.description}
                        ${shortcut.value !== undefined ?
                `<input type="text" class="shortcut-value-input" data-key="${key}" value="${shortcut.value}">` :
                ''}
                    </div>
                </div>
            `;
        }
    }
    shortcutsHTML += '</div>';

    showModal({
        title: 'Configurar Atalhos de Teclado',
        customContent: shortcutsHTML,
        buttons: [
            { text: 'Cancelar', class: 'secondary' },
            {
                text: 'Salvar Alterações',
                class: 'primary',
                onClick: () => {
                    const inputs = modalContent.querySelectorAll('.shortcut-value-input');
                    inputs.forEach(input => {
                        const key = input.dataset.key;
                        if (keyShortcuts[key]) {
                            keyShortcuts[key].value = input.value;
                        }
                    });
                    saveSettings();
                    hideModal();
                    setTimeout(() => showModal({ title: 'Sucesso', message: 'Atalhos atualizados.', buttons: [{text: 'OK'}]}), 350);
                }
            }
        ]
    });
}

optionsTab.addEventListener('click', (e) => {
    e.preventDefault();
    showOptionsModal();
});

// --- Settings Persistence ---
function saveSettings() {
    settings.shortcuts = keyShortcuts; // Save shortcuts config with other settings
    localStorage.setItem('markerboxSettings', JSON.stringify(settings));
}

function loadSettings() {
    settings = JSON.parse(localStorage.getItem('markerboxSettings') || '{}');
    // Load custom shortcuts or set defaults
    keyShortcuts = settings.shortcuts || getDefaultShortcuts();
}

function applyTheme() {
    document.body.classList.toggle('light-theme', settings.theme === 'light');
}

function startAutosave() {
    if (autosaveIntervalId) clearInterval(autosaveIntervalId);
    if (settings.autosaveEnabled) {
        autosaveIntervalId = setInterval(() => {
            const projectName = projectNameInput.value.trim();
            // Check if project exists in localStorage before autosaving
            const projects = JSON.parse(localStorage.getItem('markerboxProjects') || '{}');
            if (projectName && projects[projectName]) {
                saveProjectToLocal(projectName, true); // Pass true to indicate it's an autosave
            }
        }, parseInt(settings.autosaveInterval, 10));
    }
}

// --- Shortcuts ---
function getDefaultShortcuts() {
    return {
        'alt+M': { action: 'addRow', display: 'Alt + M', description: 'Adicionar nova marcação na aula ativa.' },
        'alt+P': { action: 'addPart', display: 'Alt + P', description: 'Adicionar nova parte na aula ativa.' },
        'alt+O': { action: 'openFile', display: 'Alt + O', description: 'Abrir seletor de arquivos de texto/vídeo.' },
        'alt+S': { action: 'saveLocal', display: 'Alt + S', description: 'Salvar decupagem atual no navegador.' },
        'alt+R': { action: 'newRev', display: 'Alt + R', description: 'Criar uma nova Revisão.' },
        'alt+F': { action: 'formatAll', display: 'Alt + F', description: 'Formatar todas as aulas.' },
        'alt+T': { action: 'exportTxt', display: 'Alt + T', description: 'Exportar tudo para .txt.' },
        'alt+X': { action: 'exportXlsx', display: 'Alt + X', description: 'Exportar tudo para .xlsx.' },
        'alt+J': { action: 'uploadJson', display: 'Alt + J', description: 'Carregar projeto de um arquivo .json.' },
        'ctrl+alt+J': { action: 'downloadJson', display: 'Ctrl + Alt + J', description: 'Baixar projeto como arquivo .json.' },
        'alt+1': { action: 'comment', display: 'Alt + 1', description: 'Preenche o campo de comentário focado com:', value: 'Introdução' },
        'alt+2': { action: 'comment', display: 'Alt + 2', description: 'Preenche o campo de comentário focado com:', value: 'Erro no áudio' },
        'alt+3': { action: 'comment', display: 'Alt + 3', description: 'Preenche o campo de comentário focado com:', value: 'Corte' },
        'alt+4': { action: 'comment', display: 'Alt + 4', description: 'Preenche o campo de comentário focado com:', value: 'Corte' },
        'alt+5': { action: 'comment', display: 'Alt + 5', description: 'Preenche o campo de comentário focado com:', value: 'Corte' },
        'alt+6': { action: 'comment', display: 'Alt + 6', description: 'Preenche o campo de comentário focado com:', value: 'Corte' },
        'alt+7': { action: 'comment', display: 'Alt + 7', description: 'Preenche o campo de comentário focado com:', value: 'Corte' },
        'alt+8': { action: 'comment', display: 'Alt + 8', description: 'Preenche o campo de comentário focado com:', value: 'Corte' },
        'alt+9': { action: 'comment', display: 'Alt + 9', description: 'Preenche o campo de comentário focado com:', value: 'Corte' },
        'alt+0': { action: 'comment', display: 'Alt + 0', description: 'Preenche o campo de comentário focado com:', value: 'Corte' },
    };
}

function handleShortcuts(e) {
    // Don't trigger shortcuts if a modal is open, unless it's the shortcut config modal itself
    if (modalOverlay.classList.contains('hidden') === false) return;

    // Don't trigger shortcuts if typing in a major text area or input field, unless it's a comment field for comment shortcuts
    const targetEl = e.target;
    const isCommentInput = targetEl.matches('input[name="comentario"]');
    const isGeneralInput = targetEl.matches('input[type="text"], textarea');

    let key = '';
    if (e.ctrlKey) key += 'ctrl+';
    if (e.altKey) key += 'alt+';
    if (e.metaKey) key += 'meta+'; // For Mac Command key
    key += e.key.toUpperCase();

    // Remap for number keys
    if (e.code.startsWith('Digit')) {
        key = key.replace(e.key.toUpperCase(), e.code.charAt(e.code.length-1));
    }

    const shortcut = keyShortcuts[key.toLowerCase()];
    if (!shortcut) return;

    // Special handling for comment shortcuts to only work on comment inputs
    if(shortcut.action === 'comment') {
        if (!isCommentInput) return;
    } else {
        // For other shortcuts, prevent them if user is typing in a general input
        if (isGeneralInput) return;
    }

    e.preventDefault(); // Prevent default browser actions (like Alt+F opening menu)

    switch(shortcut.action) {
        case 'addRow': {
            const activeAula = document.activeElement.closest('.aula-container');
            activeAula?.querySelector('.add-row-btn')?.click();
            break;
        }
        case 'addPart': {
            const activeAula = document.activeElement.closest('.aula-container');
            activeAula?.querySelector('.add-part-btn-inline')?.click();
            break;
        }
        case 'openFile': textFileInput.click(); break;
        case 'saveLocal': saveLocalBtn.click(); break;
        case 'newRev': addRevBtn.click(); break;
        case 'formatAll': formatAllBtn.click(); break;
        case 'exportTxt': exportAllBtn.click(); break;
        case 'exportXlsx': exportXlsxBtn.click(); break;
        case 'uploadJson': uploadProjectBtn.click(); break;
        case 'downloadJson': downloadProjectBtn.click(); break;
        case 'comment': {
            if (isCommentInput) {
                targetEl.value = shortcut.value;
                // Manually trigger input event if needed by other logic
                targetEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
            break;
        }
    }
}

document.addEventListener('keydown', handleShortcuts);

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadFrequentComments();
    applyTheme();

    populateLoadSelector();

    courseInput.addEventListener('input', () => {
        courseInput.value = courseInput.value.toUpperCase();
    });

    // Add document-level listener for shortcuts
    document.addEventListener('keydown', handleShortcuts);

    // Add Rev listeners
    addRevBtn.addEventListener('click', () => createRev());
    revTabsContainer.addEventListener('click', (e) => {
        const revTab = e.target.closest('.rev-tab');
        if(!revTab) return;

        const actionBtn = e.target.closest('button[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            const revId = revTab.dataset.revId;
            if (action === 'delete') {
                deleteRev(revId);
            } else if (action === 'duplicate') {
                duplicateRev(revId);
            }
            return; // Prevent switching tab when clicking a button
        }

        // If clicking on title or tab area, switch to it
        if (e.target.closest('.rev-tab-title') || e.target === revTab) {
            switchRev(revTab.dataset.revId);
        }
    });

    if (settings.startupProjectEnabled && settings.startupProject) {
        loadProjectFromLocal(settings.startupProject);
        loadProjectSelect.value = settings.startupProject;
    } else {
        if (revContentsContainer.childElementCount === 0) {
            createRev(); // Create initial Rev 1
        }
    }

    startAutosave();
});

// --- Rev Management ---
function createRev(title = null, aulasData = null) {
    revCounter++;
    const revId = `rev-${revCounter}`;

    // Create Tab
    const tab = document.createElement('div');
    tab.className = 'rev-tab';
    tab.dataset.revId = revId;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'rev-tab-title';
    titleSpan.contentEditable = true;
    titleSpan.textContent = title || `Rev ${revCounter}`;

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'rev-tab-controls';

    const duplicateBtn = document.createElement('button');
    duplicateBtn.title = 'Duplicar Revisão';
    duplicateBtn.innerHTML = '📋'; // Clipboard icon
    duplicateBtn.dataset.action = 'duplicate';

    const deleteBtn = document.createElement('button');
    deleteBtn.title = 'Excluir Revisão';
    deleteBtn.className = 'delete-rev-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.dataset.action = 'delete';

    controlsDiv.appendChild(duplicateBtn);
    controlsDiv.appendChild(deleteBtn);

    tab.appendChild(titleSpan);
    tab.appendChild(controlsDiv);

    revTabsContainer.insertBefore(tab, addRevBtn);

    // Create Content Pane
    const content = document.createElement('div');
    content.className = 'rev-content';
    content.id = revId;

    // Create Aulas Container inside Content Pane
    const aulasContainerWrapper = document.createElement('div');
    aulasContainerWrapper.style.display = 'flex';
    aulasContainerWrapper.style.flexDirection = 'column';
    aulasContainerWrapper.style.gap = '1rem';

    const revActions = document.createElement('div');
    revActions.className = 'rev-actions';
    const addAulaInRevBtn = document.createElement('button');
    addAulaInRevBtn.textContent = 'Adicionar Aula';
    addAulaInRevBtn.addEventListener('click', () => {
        const wasActive = revTabsContainer.querySelector('.rev-tab.active')?.dataset.revId;
        switchRev(revId);
        createAula({collapsed: false});
        if(wasActive && wasActive !== revId) {
            // switch back if we weren't on this tab
            // switchRev(wasActive); // This might be disorienting, maybe better to stay on the new tab.
        }
    });
    revActions.appendChild(addAulaInRevBtn);

    const aulasContainer = document.createElement('div');
    aulasContainer.className = 'aulas-container';

    aulasContainerWrapper.appendChild(revActions);
    aulasContainerWrapper.appendChild(aulasContainer);

    content.appendChild(aulasContainerWrapper);

    revContentsContainer.appendChild(content);

    // If it's the only rev, or creating a new one, or no other rev is active, switch to it
    if (revContentsContainer.childElementCount === 1 || title === null || !document.querySelector('.rev-content.active')) {
        switchRev(revId);
    }

    // Create aulas if data is provided (from duplication or load)
    if(aulasData) {
        aulasData.forEach(aulaData => createAula(aulaData));
    }
    // Create one default aula if a new rev is created manually by button
    else if (title === null) {
        createAula({collapsed: false});
    }

    return { tab, content };
}

function switchRev(revId) {
    // Deactivate current active tab and content
    const currentActiveTab = revTabsContainer.querySelector('.rev-tab.active');
    const currentActiveContent = revContentsContainer.querySelector('.rev-content.active');
    if (currentActiveTab) currentActiveTab.classList.remove('active');
    if (currentActiveContent) currentActiveContent.classList.remove('active');

    // Activate new tab and content
    const newTab = revTabsContainer.querySelector(`.rev-tab[data-rev-id="${revId}"]`);
    const newContent = revContentsContainer.querySelector(`.rev-content#${revId}`);
    if (newTab) newTab.classList.add('active');
    if (newContent) newContent.classList.add('active');
}

function duplicateRev(revId) {
    const revContent = document.getElementById(revId);
    const revTab = revTabsContainer.querySelector(`.rev-tab[data-rev-id="${revId}"]`);
    if(!revContent || !revTab) return;

    const oldTitle = revTab.querySelector('.rev-tab-title').textContent;
    const newTitle = `${oldTitle} (Cópia)`;

    // This ensures we get the state of the correct aulas
    const aulasState = Array.from(revContent.querySelectorAll('.aula-container')).map(getAulaState);

    // Create the new rev and pass its aulas data directly.
    // createRev will handle making it active.
    createRev(newTitle, aulasState);
}

function deleteRev(revId) {
    const revTab = revTabsContainer.querySelector(`.rev-tab[data-rev-id="${revId}"]`);
    const revContent = document.getElementById(revId);
    if(!revTab || !revContent) return;

    const title = revTab.querySelector('.rev-tab-title').textContent;

    showModal({
        title: "Excluir Revisão",
        message: `Tem certeza que deseja excluir a revisão "${title}" e todas as suas aulas? Esta ação não pode ser desfeita.`,
        buttons: [
            { text: "Cancelar", class: "secondary" },
            {
                text: "Excluir",
                class: "danger",
                onClick: () => {
                    const wasActive = revTab.classList.contains('active');
                    const nextSiblingTab = revTab.nextElementSibling;
                    const prevSiblingTab = revTab.previousElementSibling;

                    revTab.remove();
                    revContent.remove();

                    if (wasActive) {
                        if (nextSiblingTab && nextSiblingTab.classList.contains('rev-tab')) {
                            switchRev(nextSiblingTab.dataset.revId);
                        } else if (prevSiblingTab && prevSiblingTab.classList.contains('rev-tab')) {
                            switchRev(prevSiblingTab.dataset.revId);
                        } else if (revTabsContainer.querySelector('.rev-tab')) {
                            // fallback to first available
                            switchRev(revTabsContainer.querySelector('.rev-tab').dataset.revId);
                        } else {
                            // No tabs left, create a new one
                            createRev();
                        }
                    }
                }
            }
        ]
    });
}