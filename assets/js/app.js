import { createFileUpload } from './components/FileUpload.js';
import { createContourPreview } from './components/ContourPreview.js';
import { createProcessingControls } from './components/ProcessingControls.js';
import { createResultDisplay } from './components/ResultDisplay.js';
import { parseGlc } from './utils/glcParser.js';
import { processGlcFile } from './logic/SpecialCutProcessor.js';

function getOutputName(fileName) {
  if (!fileName) {
    return 'output_special_cut.glc';
  }
  const base = fileName.replace(/\.glc$/i, '');
  return `${base}_special_cut.glc`;
}

function renderContours(preview, parsed) {
  const contours = parsed.rooms.map((room) => room.contour);
  preview.setContours(contours);
}

function initApp(container) {
  const app = document.createElement('div');
  app.className = 'app';

  const fileState = {
    file: null,
    buffer: null,
    parsed: null
  };

  const fileUpload = createFileUpload({
    onFileLoaded: (file, buffer, error) => {
      fileState.file = file;
      fileState.buffer = buffer;

      if (error || !buffer) {
        resultDisplay.setStatus('Помилка читання файлу.', 'error');
        resultDisplay.setErrors([{ message: 'Не вдалося прочитати файл.', severity: 'error' }]);
        return;
      }

      fileUpload.setStatus(`Файл завантажено: ${file.name}`);
      processingControls.setEnabled(true);

      const parsed = parseGlc(buffer);
      fileState.parsed = parsed;
      renderContours(preview, parsed);
      resultDisplay.setResults({
        results: [],
        errors: parsed.errors,
        log: null,
        outputBytes: null,
        fileName: null
      });
    }
  });

  const preview = createContourPreview();
  const processingControls = createProcessingControls({
    onProcess: (options) => {
      if (!fileState.buffer || !fileState.file) {
        resultDisplay.setStatus('Спочатку завантажте файл.', 'error');
        return;
      }

      const processed = processGlcFile(fileState.buffer, fileState.file.name, options);
      fileState.parsed = processed.parsed;
      renderContours(preview, processed.parsed);

      resultDisplay.setResults({
        results: processed.results,
        errors: processed.log?.errors || [],
        log: processed.log,
        outputBytes: processed.outputBytes,
        fileName: getOutputName(fileState.file.name)
      });
    }
  });

  const resultDisplay = createResultDisplay();

  fileUpload.element.appendChild(processingControls.element);
  fileUpload.element.appendChild(resultDisplay.element);

  app.appendChild(fileUpload.element);
  app.appendChild(preview.element);
  container.appendChild(app);
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('vertexflow-calculator');
  if (container) {
    initApp(container);
  }
});
