

// Elementos
const aulasContainer = document.getElementById('aulas-container');
const aulaTemplate = document.getElementById('aula-template');
const addAulaBtn = document.getElementById('add-aula-btn');
const exportAllBtn = document.getElementById('export-all-btn');
const projectNameInput = document.getElementById('project-name-input');
const saveLocalBtn = document.getElementById('save-local-btn');
const downloadProjectBtn = document.getElementById('download-project-btn');
const uploadProjectBtn = document.getElementById('upload-project-btn');
const projectFileInput = document.getElementById('project-file-input');

let aulaCounter = 0;

// Cria uma nova aula
function createAula(data = {}) {
    const aulaId = `aula-${aulaCounter++}`;
    const newAula = aulaTemplate.content.cloneNode(true).firstElementChild;
    newAula.id = aulaId;

    const titleEl = newAula.querySelector('.aula-title');
    const multipartCheckbox = newAula.querySelector('.multipart-checkbox');
    const inputsWrapper = newAula.querySelector('.inputs-wrapper');
    const outputTextarea = newAula.querySelector('.output-textarea');
    const copyBtn = newAula.querySelector('.copy-btn');

    titleEl.textContent = data.title || `Aula ${aulaCounter}`;

    // Cria um textarea para input
    if (data.inputs && data.inputs.length > 0) {
        data.inputs.forEach((inputText) => {
            const ta = document.createElement('textarea');
            ta.className = 'input-part-textarea';
            ta.placeholder = 'Cole o texto aqui...';
            ta.value = inputText;
            inputsWrapper.appendChild(ta);
        });
    } else {
        const ta = document.createElement('textarea');
        ta.className = 'input-part-textarea';
        ta.placeholder = 'Cole o texto aqui...';
        inputsWrapper.appendChild(ta);
    }

    // Multipart checkbox controla adicionar/remover partes
    multipartCheckbox.checked = data.inputs && data.inputs.length > 1;
    if (multipartCheckbox.checked) {
        // Show "Adicionar parte" button
        newAula.querySelector('.add-part-btn').style.display = 'block';
    }

    // Evento checkbox multipart
    multipartCheckbox.addEventListener('change', () => {
        if (multipartCheckbox.checked) {
            if (inputsWrapper.children.length < 2) {
                const ta = document.createElement('textarea');
                ta.className = 'input-part-textarea';
                ta.placeholder = 'Cole a parte 2 do texto aqui...';
                inputsWrapper.appendChild(ta);
            }
            newAula.querySelector('.add-part-btn').style.display = 'block';
        } else {
            while (inputsWrapper.children.length > 1) {
                inputsWrapper.removeChild(inputsWrapper.lastChild);
            }
            newAula.querySelector('.add-part-btn').style.display = 'none';
        }
    });

    // Botão adicionar parte
    newAula.querySelector('.add-part-btn').addEventListener('click', () => {
        const ta = document.createElement('textarea');
        ta.className = 'input-part-textarea';
        ta.placeholder = `Cole a parte ${inputsWrapper.children.length + 1} do texto aqui...`;
        inputsWrapper.appendChild(ta);
    });

    // Botão copiar resultado
    copyBtn.addEventListener('click', async () => {
        if (!outputTextarea.value) return;
        try {
            await navigator.clipboard.writeText(outputTextarea.value);
            copyBtn.textContent = 'Copiado!';
            setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 2000);
        } catch {
            copyBtn.textContent = 'Falhou!';
        }
    });

    // Botão exportar individual
    newAula.querySelector('.export-individual-btn').addEventListener('click', () => {
        if (!outputTextarea.value.trim()) {
            alert('Nenhum resultado para exportar nesta aula.');
            return;
        }
        const blob = new Blob([outputTextarea.value], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${titleEl.textContent.replace(/\s+/g, '_').toLowerCase()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Botão remover aula
    newAula.querySelector('.remove-aula-btn').addEventListener('click', () => {
        if (confirm(`Remover "${titleEl.textContent}"?`)) {
            newAula.remove();
        }
    });

    // Botão formatar que chama a IA
    newAula.querySelector('.format-btn').addEventListener('click', async () => {
        const allInputs = Array.from(inputsWrapper.querySelectorAll('textarea')).map(ta => ta.value.trim()).filter(Boolean).join('\n\n---\n\n');
        const promptGeneral = document.getElementById('global-prompt-textarea').value.trim();

        if (!promptGeneral) {
            alert('Por favor, preencha o campo de instruções gerais.');
            return;
        }
        if (!allInputs) {
            alert('Por favor, cole o texto para formatar.');
            return;
        }

        outputTextarea.value = 'Formatando... aguarde...';
        try {
            const GEMINI_API_KEY = document.getElementById('API_KEY').value.trim();
            const completion = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
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
            });

            if (!completion.ok) {
                const err = await completion.json();
                outputTextarea.value = `Erro na API: ${err.error?.message || 'Desconhecido'}`;
                return;
            }

            const data = await completion.json();
            outputTextarea.value = data.candidates[0].content.parts[0].text.trim();
        } catch (e) {
            outputTextarea.value = `Erro: ${e.message}`;
        }
    });

    aulasContainer.appendChild(newAula);
}

// Exportar tudo junto
exportAllBtn.addEventListener('click', () => {
    let fullText = '';
    const projectName = projectNameInput.value.trim() || 'decupagem_formatada';

    document.querySelectorAll('.aula-container').forEach(aulaEl => {
        const title = aulaEl.querySelector('.aula-title').textContent;
        const output = aulaEl.querySelector('.output-textarea').value || 'Nenhum resultado gerado.';
        fullText += `//--- ${title} ---//\n\n${output}\n\n`;
    });

    if (!fullText.trim()) {
        alert('Nenhum conteúdo para exportar.');
        return;
    }

    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Salvar projeto no localStorage
saveLocalBtn.addEventListener('click', () => {
    const projectName = projectNameInput.value.trim();
    if (!projectName) {
        alert('Por favor, digite um nome para o projeto antes de salvar.');
        return;
    }

    const aulas = Array.from(document.querySelectorAll('.aula-container')).map(aulaEl => {
        const title = aulaEl.querySelector('.aula-title').textContent;
        const inputs = Array.from(aulaEl.querySelectorAll('.inputs-wrapper textarea')).map(ta => ta.value);
        const output = aulaEl.querySelector('.output-textarea').value;
        return { title, inputs, output };
    });

    const project = {
        projectName,
        aulas
    };

    localStorage.setItem('decupagemProject', JSON.stringify(project));
    alert(`Projeto "${projectName}" salvo no navegador.`);
});

// Carregar projeto do localStorage
function loadProject() {
    const projectStr = localStorage.getItem('decupagemProject');
    if (!projectStr) return;

    try {
        const project = JSON.parse(projectStr);
        projectNameInput.value = project.projectName || '';
        aulasContainer.innerHTML = '';
        aulaCounter = 0;
        if (project.aulas && project.aulas.length > 0) {
            project.aulas.forEach(aulaData => createAula(aulaData));
        } else {
            createAula();
        }
    } catch {
        console.warn('Erro ao carregar projeto do localStorage');
    }
}

loadProject();

// Download do projeto em arquivo JSON
downloadProjectBtn.addEventListener('click', () => {
    const projectName = projectNameInput.value.trim() || 'decupagem';
    const aulas = Array.from(document.querySelectorAll('.aula-container')).map(aulaEl => {
        const title = aulaEl.querySelector('.aula-title').textContent;
        const inputs = Array.from(aulaEl.querySelectorAll('.inputs-wrapper textarea')).map(ta => ta.value);
        const output = aulaEl.querySelector('.output-textarea').value;
        return { title, inputs, output };
    });
    const project = {
        projectName,
        aulas
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Upload do projeto a partir do arquivo JSON
uploadProjectBtn.addEventListener('click', () => {
    projectFileInput.click();
});

projectFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const project = JSON.parse(ev.target.result);
            projectNameInput.value = project.projectName || '';
            aulasContainer.innerHTML = '';
            aulaCounter = 0;
            if (project.aulas && project.aulas.length > 0) {
                project.aulas.forEach(aulaData => createAula(aulaData));
            } else {
                createAula();
            }
        } catch {
            alert('Arquivo inválido');
        }
    };
    reader.readAsText(file);
});
  
// Botão adicionar aula
addAulaBtn.addEventListener('click', () => {
    createAula();
});
