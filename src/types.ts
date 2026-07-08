export interface PixelArtProject {
  id: string;
  name: string;
  width: number;
  height: number;
  palette: string[];
  rle: string;
  createdAt: string;
  description?: string;
  category?: string;
}

export interface CanvasState {
  width: number;
  height: number;
  grid: string[]; // Flat array of colors (e.g., '#000000', 'transparent')
  palette: string[];
}

export type ToolType = 'pen' | 'eraser' | 'bucket' | 'picker';

export interface PresetTemplate {
  name: string;
  category: string;
  width: number;
  height: number;
  palette: string[];
  rle: string;
  description: string;
}
