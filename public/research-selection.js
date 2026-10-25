// Research follows the last explicit selection, never a priority ordering of
// unrelated panels that happen to remain open. Background renders do not select.
export function padawanResearchContext(selection, payload = {}) {
  if (selection?.kind === 'locality') {
    const item = payload.mppLocalities?.items?.find(x => x.code === selection.id);
    return item ? { label: item.name } : null;
  }
  if (selection?.kind === 'gauge') {
    const item = payload.infobanjir?.stations?.find(x => x.id === selection.id);
    return item ? { label: item.name, observedAt: item.observedAt ? item.observedAt + ' MYT (UTC+08)' : null } : null;
  }
  return selection?.kind === 'ward' && selection.id ? { label: 'MPP · ' + selection.id } : null;
}
