import { TOOLS } from "./toolSettings.js";

export const TOOL_ICONS = {
  [TOOLS.SETTINGS]: "assets/tools/settings.svg",
  [TOOLS.EMOJIS]: "assets/tools/emojis.svg",
  [TOOLS.YOUTUBE_PLAYLIST]: "assets/tools/youtube-playlist.svg",
  [TOOLS.VIDEO_DOWNLOADER]: "assets/tools/video-downloader.svg",
  [TOOLS.CLOUDFLARE_DOCKER]: "assets/tools/cloudflare-docker.svg",
  [TOOLS.CURRENCY_CONVERTER]: "assets/tools/currency-converter.svg",
  [TOOLS.POINTS_CONVERTER]: "assets/tools/points-converter.svg",
  [TOOLS.FORM_INJECT]: "assets/tools/form-inject.svg",
  [TOOLS.COLORS]: "assets/tools/colors.svg",
};

export function getToolIconPath(toolId) {
  return TOOL_ICONS[toolId] ?? "assets/tools/default.svg";
}
