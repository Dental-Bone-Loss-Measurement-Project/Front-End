export default function setTitleAndDescription(titleText, descriptionText) {
  const title = document.getElementById('demo-title');
  const description = document.getElementById('demo-description');

  if (!title || !description) {
    console.error('Title or description element not found in the DOM');
    return;
  }

  title.innerText = titleText;
  description.innerText = descriptionText;
}