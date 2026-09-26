// Twitter использует ту же карточку (Next требует отдельный файл; `runtime`
// из другого файла ре-экспортировать нельзя — парсится статически).
export const runtime = "nodejs"
export { default, alt, size, contentType } from "./opengraph-image"
