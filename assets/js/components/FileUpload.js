export function createFileUpload({ onFileLoaded }) {
  const wrapper = document.createElement('section');
  wrapper.className = 'panel controls';

  const title = document.createElement('h1');
  title.textContent = 'Калькулятор спецрозкрою (.glc)';

  const field = document.createElement('div');
  field.className = 'field';

  const label = document.createElement('span');
  label.textContent = 'Завантажити файл .glc';

  const dropZone = document.createElement('div');
  dropZone.className = 'drop-zone';
  dropZone.tabIndex = 0;

  const dropText = document.createElement('p');
  dropText.className = 'drop-zone__text';
  dropText.textContent = 'Перетягніть файл сюди або оберіть вручну.';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.glc';
  input.className = 'drop-zone__input';

  dropZone.appendChild(dropText);
  dropZone.appendChild(input);

  field.appendChild(label);
  field.appendChild(dropZone);
  wrapper.appendChild(title);
  wrapper.appendChild(field);

  const setHover = (on) => {
    dropZone.classList.toggle('is-hover', on);
  };

  const handleFile = (file) => {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onFileLoaded?.(file, reader.result);
    };
    reader.onerror = () => {
      onFileLoaded?.(file, null, reader.error);
    };
    reader.readAsArrayBuffer(file);
  };

  dropZone.addEventListener('click', () => input.click());
  input.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    handleFile(file);
  });

  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    setHover(true);
  });

  dropZone.addEventListener('dragleave', () => setHover(false));
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    setHover(false);
    const file = event.dataTransfer?.files?.[0];
    handleFile(file);
  });

  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });

  return {
    element: wrapper,
    setStatus: (text) => {
      dropText.textContent = text;
    }
  };
}
