import React from 'react';
import ReactDOM from 'react-dom/client';
import { utilities as csUtilities } from '@cornerstonejs/core';

import createElement, { configElement } from './createElement';

interface configButton extends configElement {
  id?: string;
  title: string;
  container?: HTMLElement;
  icon?: React.ReactElement;
  onClick: () => void;
  className?: string;
}

export default function addButtonToToolbar(config: configButton): HTMLButtonElement {
  config = csUtilities.deepMerge(config, config.merge);

  config.container = config.container ?? document.getElementById('demo-toolbar') ?? undefined;

  const elButton = document.createElement('button');

  if (config.id) elButton.id = config.id;
  if (config.className) elButton.className = config.className;
  if (config.onClick) elButton.onclick = config.onClick;

  // Create a div to hold icon + title (optional)
  if (config.icon) {
    const iconWrapper = document.createElement('span');
    const root = ReactDOM.createRoot(iconWrapper);
    root.render(config.icon);
    elButton.appendChild(iconWrapper);
  }

  if (config.title) {
    const titleText = document.createElement('span');
    titleText.className = 'ml-2'; // optional spacing between icon and text
    titleText.textContent = config.title;
    elButton.appendChild(titleText);
  }

  config.container?.appendChild(elButton);

  return elButton;
}
