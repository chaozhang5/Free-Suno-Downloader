export type DownloadAsset = {
  type: 'audio' | 'video' | 'image';
  extension: string;
  encrypted?: boolean;
  downloadUrl: string;
  previewUrl: string;
  filename?: string;
};

export type SongResult = {
  title: string;
  image: string | null;
  sourceUrl: string;
  contentId?: string | null;
  artist?: string;
  duration?: number | null;
  createdAt?: string | null;
  playCount?: number | null;
  likeCount?: number | null;
  description?: string;
  lyrics?: string;
  model?: string;
  assets: DownloadAsset[];
};
