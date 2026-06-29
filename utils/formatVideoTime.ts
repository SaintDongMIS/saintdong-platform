export function formatVideoTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function youtubeSeekUrl(youtubeId: string, startSeconds: number): string {
  return `https://www.youtube.com/watch?v=${youtubeId}&t=${startSeconds}s`;
}
