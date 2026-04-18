import type { FlowNodeKind } from '../canvas/flowTypes'

export type PaletteItem = {
  kind: FlowNodeKind
  label: string
  description: string
}

export const paletteItems: PaletteItem[] = [
  {
    kind: 'start',
    label: 'Start',
    description: 'Entry point',
  },
  {
    kind: 'process',
    label: 'Process',
    description: 'Standard step',
  },
  {
    kind: 'decision',
    label: 'Decision',
    description: 'Yes/no branch',
  },
  {
    kind: 'message',
    label: 'Message',
    description: 'WhatsApp or email',
  },
  {
    kind: 'note',
    label: 'Sticky note',
    description: 'Free-form note pad',
  },
  {
    kind: 'task',
    label: 'Task',
    description: 'Work to assign',
  },
  {
    kind: 'wait',
    label: 'Wait',
    description: 'Delay or pause',
  },
  {
    kind: 'end',
    label: 'End',
    description: 'Flow complete',
  },
]
