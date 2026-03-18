export function createResultDisplay() {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';

  const label = document.createElement('span');
  label.textContent = 'Результати обробки';

  const stats = document.createElement('div');
  stats.className = 'stats';
  stats.textContent = 'Результати ще не згенеровані.';

  const status = document.createElement('div');
  status.className = 'status info';
  status.textContent = 'Очікується файл для обробки.';

  const errorPanel = document.createElement('div');
  errorPanel.className = 'error-panel';

  const actions = document.createElement('div');
  actions.className = 'actions';

  const downloadButton = document.createElement('button');
  downloadButton.type = 'button';
  downloadButton.textContent = 'Завантажити';
  downloadButton.disabled = true;

  actions.appendChild(downloadButton);

  wrapper.appendChild(label);
  wrapper.appendChild(stats);
  wrapper.appendChild(status);
  wrapper.appendChild(errorPanel);
  wrapper.appendChild(actions);

  let currentBytes = null;
  let currentFileName = null;

  const updateStatus = (text, type = 'info') => {
    status.textContent = text;
    status.className = `status ${type}`;
  };

  const setErrors = (errors = []) => {
    errorPanel.innerHTML = '';
    errors.forEach((error) => {
      const item = document.createElement('div');
      item.className = `error-item ${error.severity === 'warning' ? 'warn' : 'error'}`;
      item.textContent = error.message;
      errorPanel.appendChild(item);
    });
  };

  downloadButton.addEventListener('click', () => {
    if (!currentBytes || !currentFileName) {
      return;
    }
    const blob = new Blob([currentBytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  return {
    element: wrapper,
    setResults: ({ results = [], errors = [], outputBytes = null, fileName = null }) => {
      currentBytes = outputBytes;
      currentFileName = fileName;

      const totalAngles = results.reduce((sum, res) => sum + res.internalAnglesFound, 0);
      const processedAngles = results.reduce((sum, res) => sum + res.internalAnglesProcessed, 0);
      const skippedAngles = results.reduce((sum, res) => sum + res.internalAnglesSkipped, 0);

      stats.textContent = `Внутрішніх кутів: ${totalAngles}, оброблено: ${processedAngles}, пропущено: ${skippedAngles}.`;
      downloadButton.disabled = !outputBytes;

      if (errors.some((e) => e.severity === 'error')) {
        updateStatus('Виявлено помилки у файлі.', 'error');
      } else if (processedAngles > 0) {
        updateStatus('Обробку завершено.', 'success');
      } else {
        updateStatus('Обробка завершена без змін.', 'info');
      }

      setErrors(errors);
    },
    setStatus: updateStatus,
    setErrors
  };
}
