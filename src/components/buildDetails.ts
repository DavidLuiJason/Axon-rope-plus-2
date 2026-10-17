/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Capability } from '../capabilities/types';
import type { InterfaceDescriptor } from '../interfaces/types';

export interface DetailSection {
  label: string;
  lines: string[];
}

export interface DetailView {
  sections: DetailSection[];
}

export function describeCapability(cap: Capability): DetailView {
  const sections: DetailSection[] = [];

  // 1. Contract
  sections.push({
    label: 'Contract',
    lines: [
      `Contract version ${cap.contractVersion}`,
      `Implementation version ${cap.implementationVersion}`,
    ],
  });

  // 2. Permissions (advisory)
  const permissionLines =
    cap.permissions && cap.permissions.length > 0
      ? cap.permissions
      : ['none declared'];
  sections.push({
    label: 'Permissions (advisory)',
    lines: permissionLines,
  });

  // 3. Resource needs (advisory)
  const resourceLines =
    cap.resourceNeeds && cap.resourceNeeds.length > 0
      ? cap.resourceNeeds
      : ['none declared'];
  sections.push({
    label: 'Resource needs (advisory)',
    lines: resourceLines,
  });

  // 4. Your data
  let dataLine = 'Not declared.';
  if (cap.dataProvider === 'noUserData') {
    dataLine = 'Stores nothing of yours.';
  } else if ((cap.dataProvider as unknown) === 'userData') {
    dataLine = 'Keeps your data on this phone.';
  }
  sections.push({
    label: 'Your data',
    lines: [dataLine],
  });

  // 5. Chat actions
  const chatActionLines: string[] = [];
  if (cap.chatActions && cap.chatActions.length > 0) {
    for (const action of cap.chatActions) {
      let statusStr = '';
      if (action.status === 'available') {
        statusStr = 'works in chat';
      } else if (action.status === 'needs-screen') {
        statusStr = 'needs a screen';
      } else if (action.status === 'needs-permission') {
        statusStr = 'needs permission';
      } else if (action.status === 'not-built') {
        statusStr = 'not built yet';
      } else {
        statusStr = action.status;
      }
      chatActionLines.push(`${action.purpose}: ${statusStr}`);
      if (action.examples && action.examples.length > 0) {
        chatActionLines.push(`Try: ${action.examples[0]}`);
      }
    }
  } else {
    chatActionLines.push(cap.noChatAction || 'No chat action declared.');
  }
  sections.push({
    label: 'Chat actions',
    lines: chatActionLines,
  });

  return { sections };
}

export function describeInterface(
  iface: InterfaceDescriptor,
  all: InterfaceDescriptor[]
): DetailView {
  const sections: DetailSection[] = [];

  // 1. Kind
  sections.push({
    label: 'Kind',
    lines: [iface.kind],
  });

  // 2. Navigation
  sections.push({
    label: 'Navigation',
    lines: [
      iface.isNavigable
        ? 'Opens as a screen of its own.'
        : 'Not a screen of its own.',
    ],
  });

  // 3. Parent
  let parentLine = 'None (top level)';
  if (iface.parentId !== null && iface.parentId !== undefined) {
    const parent = all.find((item) => item.interfaceId === iface.parentId);
    parentLine = parent ? parent.displayName : 'Unknown parent';
  }
  sections.push({
    label: 'Parent',
    lines: [parentLine],
  });

  return { sections };
}
