// Przekazuje konfigurację quizu z ekranu startowego do widoku quizu (bez cyklicznych importów).
let pending = null;
export const setLaunch = (cfg) => { pending = cfg; };
export const takeLaunch = () => { const c = pending; pending = null; return c; };

// Ustawienie zestawu na ekranie startowym przy przejściu z innych widoków (np. "Ćwicz tę listę").
let preselect = null;
export const setPreselect = (listId) => { preselect = listId; };
export const takePreselect = () => { const l = preselect; preselect = null; return l; };

// Ustawienia sesji fiszek z ekranu startowego.
let cards = null;
export const setCards = (cfg) => { cards = cfg; };
export const takeCards = () => { const c = cards; cards = null; return c; };
