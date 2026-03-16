export function createProcessingControls({ onProcess }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';

  const label = document.createElement('span');
  label.textContent = 'Параметри обробки';

  const checkboxWrap = document.createElement('label');
  checkboxWrap.className = 'checkbox';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = true;

  const checkboxText = document.createElement('span');
  checkboxText.textContent = 'Не обробляти колони і простінки';

  checkboxWrap.appendChild(checkbox);
  checkboxWrap.appendChild(checkboxText);

  const actions = document.createElement('div');
  actions.className = 'actions';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Обробити';
  button.disabled = true;

  actions.appendChild(button);

  wrapper.appendChild(label);
  wrapper.appendChild(checkboxWrap);
  wrapper.appendChild(actions);

  button.addEventListener('click', () => {
    onProcess?.({ skipColumns: checkbox.checked });
  });

  return {
    element: wrapper,
    setEnabled: (enabled) => {
      button.disabled = !enabled;
    },
    getOptions: () => ({ skipColumns: checkbox.checked })
  };
}
