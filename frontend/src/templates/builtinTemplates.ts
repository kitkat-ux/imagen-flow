import type { Edge, Node } from '@xyflow/react'

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  graph: {
    nodes: Node<any>[]
    edges: Edge[]
  }
}

export const BUILTIN_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'styled-t2i',
    name: 'Styled Prompt to Image',
    description: 'Compose a prompt from subject and style preset before WeryAI T2I.',
    graph: {
      nodes: [
        {
          id: 'tpl_styled_subject',
          type: 'input.text',
          position: { x: 60, y: 100 },
          data: {
            nodeType: 'input.text',
            params: { value: 'A luxury electric bicycle on a city street' },
          } as any,
        },
        {
          id: 'tpl_styled_style',
          type: 'prompt.style_preset',
          position: { x: 60, y: 300 },
          data: {
            nodeType: 'prompt.style_preset',
            params: { style: 'product_photo', custom: '' },
          } as any,
        },
        {
          id: 'tpl_styled_composer',
          type: 'prompt.composer',
          position: { x: 430, y: 180 },
          data: {
            nodeType: 'prompt.composer',
            params: {
              prefix: '',
              suffix: 'premium commercial campaign, high quality, detailed',
              negative_preset: 'product',
              negative_extra: '',
            },
          } as any,
        },
        {
          id: 'tpl_styled_gen',
          type: 'weryai.gpt_image_2.text2image',
          position: { x: 820, y: 180 },
          data: {
            nodeType: 'weryai.gpt_image_2.text2image',
            params: { aspect_ratio: '16:9(2k)', quality: 'medium', negative_prompt: '' },
          } as any,
        },
      ],
      edges: [
        { id: 'tpl_styled_e1', source: 'tpl_styled_subject', sourceHandle: 'text', target: 'tpl_styled_composer', targetHandle: 'subject' },
        { id: 'tpl_styled_e2', source: 'tpl_styled_style', sourceHandle: 'style', target: 'tpl_styled_composer', targetHandle: 'style' },
        { id: 'tpl_styled_e3', source: 'tpl_styled_composer', sourceHandle: 'prompt', target: 'tpl_styled_gen', targetHandle: 'prompt' },
      ],
    },
  },
  {
    id: 'weryai-t2i',
    name: 'WeryAI Text to Image',
    description: 'Prompt to WeryAI GPT Image 2. Image appears directly on the generator node.',
    graph: {
      nodes: [
        {
          id: 'tpl_t2i_prompt',
          type: 'input.text',
          position: { x: 80, y: 140 },
          data: {
            nodeType: 'input.text',
            params: { value: 'A cinematic product photo on a clean studio background' },
          } as any,
        },
        {
          id: 'tpl_t2i_gen',
          type: 'weryai.gpt_image_2.text2image',
          position: { x: 430, y: 120 },
          data: {
            nodeType: 'weryai.gpt_image_2.text2image',
            params: { aspect_ratio: '16:9(2k)', quality: 'medium', negative_prompt: '' },
          } as any,
        },
      ],
      edges: [
        {
          id: 'tpl_t2i_e1',
          source: 'tpl_t2i_prompt',
          sourceHandle: 'text',
          target: 'tpl_t2i_gen',
          targetHandle: 'prompt',
        },
      ],
    },
  },
  {
    id: 'local-i2i',
    name: 'Local Image to Image',
    description: 'Upload a local image to storage, then use it as WeryAI I2I reference.',
    graph: {
      nodes: [
        {
          id: 'tpl_local_img',
          type: 'input.local_image',
          position: { x: 80, y: 120 },
          data: {
            nodeType: 'input.local_image',
            params: { url: '' },
          } as any,
        },
        {
          id: 'tpl_i2i_prompt',
          type: 'input.text',
          position: { x: 80, y: 340 },
          data: {
            nodeType: 'input.text',
            params: { value: 'Change the outfit to a premium fashion editorial look' },
          } as any,
        },
        {
          id: 'tpl_i2i_gen',
          type: 'weryai.gpt_image_2.image2image',
          position: { x: 500, y: 220 },
          data: {
            nodeType: 'weryai.gpt_image_2.image2image',
            params: { aspect_ratio: '1:1', quality: 'medium', negative_prompt: '' },
          } as any,
        },
      ],
      edges: [
        {
          id: 'tpl_i2i_e1',
          source: 'tpl_local_img',
          sourceHandle: 'image',
          target: 'tpl_i2i_gen',
          targetHandle: 'image',
        },
        {
          id: 'tpl_i2i_e2',
          source: 'tpl_i2i_prompt',
          sourceHandle: 'text',
          target: 'tpl_i2i_gen',
          targetHandle: 'prompt',
        },
      ],
    },
  },
  {
    id: 't2i-to-i2i',
    name: 'T2I to I2I Chain',
    description: 'Generate a base image, then edit it with a second prompt.',
    graph: {
      nodes: [
        {
          id: 'tpl_chain_p1',
          type: 'input.text',
          position: { x: 60, y: 80 },
          data: {
            nodeType: 'input.text',
            params: { value: 'A modern mountain cabin at sunrise, photorealistic' },
          } as any,
        },
        {
          id: 'tpl_chain_t2i',
          type: 'weryai.gpt_image_2.text2image',
          position: { x: 400, y: 80 },
          data: {
            nodeType: 'weryai.gpt_image_2.text2image',
            params: { aspect_ratio: '16:9(2k)', quality: 'medium', negative_prompt: '' },
          } as any,
        },
        {
          id: 'tpl_chain_p2',
          type: 'input.text',
          position: { x: 60, y: 340 },
          data: {
            nodeType: 'input.text',
            params: { value: 'Make it snowy at night with warm lights inside the windows' },
          } as any,
        },
        {
          id: 'tpl_chain_i2i',
          type: 'weryai.gpt_image_2.image2image',
          position: { x: 780, y: 210 },
          data: {
            nodeType: 'weryai.gpt_image_2.image2image',
            params: { aspect_ratio: '16:9(2k)', quality: 'medium', negative_prompt: '' },
          } as any,
        },
      ],
      edges: [
        { id: 'tpl_chain_e1', source: 'tpl_chain_p1', sourceHandle: 'text', target: 'tpl_chain_t2i', targetHandle: 'prompt' },
        { id: 'tpl_chain_e2', source: 'tpl_chain_t2i', sourceHandle: 'image', target: 'tpl_chain_i2i', targetHandle: 'image' },
        { id: 'tpl_chain_e3', source: 'tpl_chain_p2', sourceHandle: 'text', target: 'tpl_chain_i2i', targetHandle: 'prompt' },
      ],
    },
  },
  {
    id: 'local-i2i-save',
    name: 'Local I2I and Save',
    description: 'Upload a local reference, run I2I, then save the result to Gallery.',
    graph: {
      nodes: [
        {
          id: 'tpl_save_local',
          type: 'input.local_image',
          position: { x: 60, y: 110 },
          data: { nodeType: 'input.local_image', params: { url: '' } } as any,
        },
        {
          id: 'tpl_save_prompt',
          type: 'input.text',
          position: { x: 60, y: 320 },
          data: {
            nodeType: 'input.text',
            params: { value: 'Turn this into a clean product catalog image' },
          } as any,
        },
        {
          id: 'tpl_save_i2i',
          type: 'weryai.gpt_image_2.image2image',
          position: { x: 460, y: 210 },
          data: {
            nodeType: 'weryai.gpt_image_2.image2image',
            params: { aspect_ratio: '1:1', quality: 'medium', negative_prompt: '' },
          } as any,
        },
        {
          id: 'tpl_save_out',
          type: 'output.save',
          position: { x: 840, y: 230 },
          data: { nodeType: 'output.save', params: {} } as any,
        },
      ],
      edges: [
        { id: 'tpl_save_e1', source: 'tpl_save_local', sourceHandle: 'image', target: 'tpl_save_i2i', targetHandle: 'image' },
        { id: 'tpl_save_e2', source: 'tpl_save_prompt', sourceHandle: 'text', target: 'tpl_save_i2i', targetHandle: 'prompt' },
        { id: 'tpl_save_e3', source: 'tpl_save_i2i', sourceHandle: 'image', target: 'tpl_save_out', targetHandle: 'image' },
        { id: 'tpl_save_e4', source: 'tpl_save_prompt', sourceHandle: 'text', target: 'tpl_save_out', targetHandle: 'prompt' },
      ],
    },
  },
  {
    id: 't2i-save',
    name: 'T2I and Save',
    description: 'Generate an image from text and save it directly to Gallery.',
    graph: {
      nodes: [
        {
          id: 'tpl_t2is_prompt',
          type: 'input.text',
          position: { x: 70, y: 140 },
          data: {
            nodeType: 'input.text',
            params: { value: 'A high-end perfume bottle, dramatic studio lighting, luxury ad' },
          } as any,
        },
        {
          id: 'tpl_t2is_gen',
          type: 'weryai.gpt_image_2.text2image',
          position: { x: 420, y: 110 },
          data: {
            nodeType: 'weryai.gpt_image_2.text2image',
            params: { aspect_ratio: '1:1', quality: 'medium', negative_prompt: '' },
          } as any,
        },
        {
          id: 'tpl_t2is_save',
          type: 'output.save',
          position: { x: 780, y: 140 },
          data: { nodeType: 'output.save', params: {} } as any,
        },
      ],
      edges: [
        { id: 'tpl_t2is_e1', source: 'tpl_t2is_prompt', sourceHandle: 'text', target: 'tpl_t2is_gen', targetHandle: 'prompt' },
        { id: 'tpl_t2is_e2', source: 'tpl_t2is_gen', sourceHandle: 'image', target: 'tpl_t2is_save', targetHandle: 'image' },
        { id: 'tpl_t2is_e3', source: 'tpl_t2is_prompt', sourceHandle: 'text', target: 'tpl_t2is_save', targetHandle: 'prompt' },
      ],
    },
  },
]
