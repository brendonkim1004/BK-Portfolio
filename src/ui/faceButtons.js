// Keyboard access to the cube: one real (visually hidden) button per face.
// Focusing a button turns the cube to that face; Enter or Space opens it.
export function createFaceButtons(listEl, faces, { onFocus, onBlur, onOpen }) {
  faces.forEach(({ color, project }, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = project ? `Open project: ${project.title}` : `${color} face: coming soon`;
    button.addEventListener('focus', () => onFocus(index));
    button.addEventListener('blur', () => onBlur(index));
    button.addEventListener('click', () => onOpen(index));
    item.append(button);
    listEl.append(item);
  });
}
