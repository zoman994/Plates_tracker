# CloneTracker v1.0.0

Десктопное приложение (Electron + React) для учёта клонов при высокопроизводительном скрининге мутантов A. niger. Portable EXE, работает оффлайн. Светлая / тёмная тема.

## Контекст лаборатории

- Организм: Aspergillus niger, штамм ВКПМ F-1064 (pyrG+)
- Мутагенез: NTG (нитрозогуанидин), UV, CRISPR, EMS, ARTP
- Масштаб: 500-1000 клонов на раунд
- Скрининг: глюкоамилаза (ДНС-ассей), в будущем другие ферменты
- Оборудование: Tecan EVO150 (EVOware Standard), Feyond A400 ридер
- Формат планшетов: 96-well (8x12) для пикинга/пассажей, 48-DWP (8x6) для культивирования

## Пайплайн клонов

```
Чашка Петри (мутагенез)
  -> Пикинг в 96-well (Source plate, S01, S02...)
    -> Пассаж 96->96 (Passage plate, P01...)
      -> Transfer 96->N x 48-DWP (Culture plates, C01, C02..., 2x или 3x повтора)
        -> Feyond A400 ридер (OD / ДНС-ассей)
          -> Ранкинг по mean повторов, ratio vs WT
            -> Топ клоны в колбы
```

## Геометрия 48-DWP

48-well deep-well block = **8 строк x 6 столбцов** (НЕ 6x8!).

### Раскладка "по строкам" (rows) — повторы горизонтально (по умолчанию):
```
     1      2      3      4      5      6
A:  К1.r1  К1.r2  К1.r3  К2.r1  К2.r2  К2.r3
...
H:  К15.r1 К15.r2 К15.r3 WT.r1  WT.r2  WT.r3
```

### Раскладка "по столбцам" (cols) — повторы вертикально:
```
     1      2      3      4      5      6
A:  К1.r1  К2.r1  К3.r1  К4.r1  К5.r1  К6.r1
B:  К1.r2  К2.r2  К3.r2  К4.r2  К5.r2  К6.r2
C:  К1.r3  К2.r3  К3.r3  К4.r3  К5.r3  К6.r3
...
```

Количество клонов на планшет: `clonesPerPlate(replicates, layout)` (rows: `floor(6/rep)*8 - 1`, cols: `floor(8/rep)*6 - 1`).

## Идентификатор клона

Формат: `{EXPERIMENT}-{PLATE}-{WELL}`, например `NTG1-S01-B7`.
Присваивается при пикинге, **не меняется** при пересадках.

## Техстек

- **Electron 31** — десктопное приложение, portable EXE
- **React 18 + Vite 6** — UI
- **Tailwind CSS 3** — стили
- **Zustand 5** — state management с persist middleware
- **SheetJS (xlsx)** — импорт/экспорт Excel файлов (отдельный chunk)
- **qrcode** — генерация QR-кодов для этикеток (отдельный chunk)
- Автосохранение: localStorage + JSON файл на диске (через Electron IPC)
- Светлая/тёмная тема: ThemeContext + localStorage

## Code splitting (Vite)

`xlsx` и `qrcode` вынесены в отдельные chunks через `rollupOptions.output.manualChunks` — они не грузятся до первого использования.

## Структура проекта

```
electron/
  main.cjs              — Electron main process (IPC: save/load/backup)
  preload.cjs           — contextBridge для file system доступа
src/
  App.jsx               — главный компонент, табы, модалки, Ctrl+S, beforeunload
  main.jsx              — entry point
  index.css             — Tailwind directives
  components/
    PlateMap.jsx         — SVG plate map с drag-selection (локальный state)
    HeatmapPlate.jsx     — SVG heatmap для OD данных (прямоугольные лунки 48-DWP)
    TransferView.jsx     — dual-panel transfer preview с drag-and-drop порядком клонов
    SourceView.jsx       — мини source plate с highlighting
    RankingTab.jsx       — таблица ранкинга клонов
    AnalysisTab.jsx      — таб "Анализ": выбор планшета, xlsx импорт, heatmap с кликом для правки OD
    StatsTab.jsx         — таб "Статистика": поиск клонов, survival rate, OD гистограмма, мульти-эксп ранкинг
    PipelineView.jsx     — SVG граф эксперимента (source->passage->culture)
    PhotoAnalysis.jsx    — анализ фото 96-well: калибровка 4 углов, Canvas pixel analysis
    LabelPrint.jsx       — генерация этикеток 57x40мм (ч/б, QR, мини-карта) + печать A4
    EditClonesModal.jsx  — ручное редактирование клонов на 48-DWP
    Modal.jsx            — модальное окно (wide prop)
    Btn.jsx              — кнопка с вариантами (primary/secondary/danger/ghost)
  forms/
    NewExpForm.jsx       — создание эксперимента
    NewPlateForm.jsx     — создание планшета
    TransferSetup.jsx    — настройка трансфера (повторности 2x/3x, раскладка rows/cols)
    AssayForm.jsx        — импорт OD (xlsx файл или paste текст, скачать шаблон)
    PickingImportForm.jsx — импорт пикинга из xlsx + отдельные поля WT/Blank
    CloneCounterImportForm.jsx — импорт JSON из CloneCounter (координаты колоний)
    TecanConfigForm.jsx  — настройки Tecan EVO150 (rack'и, объёмы, tips, wash)
    styles.js            — общий Tailwind-класс для input
  store/
    useStore.js          — Zustand store: data + UI + undo/redo + все actions
  lib/
    geometry.js          — константы (ROWS, COLS, WELL_STATUS, PLATE_TYPES, EXP_TYPES), posToWell, genId, clonesPerPlate
    generate48Layout.js  — раскладка клонов на 48-DWP (replicates: 2/3, layout: rows/cols)
    ranking.js           — computeRanking(plates, expId) -> {ranked, wtMean, wtN}
    xlsxParser.js        — парсинг xlsx: parseXlsx, parseAssayXlsx, parsePickingXlsx (с валидацией)
    exportXlsx.js        — экспорт: exportPlate (1 планшет), exportExperiment (все + сводка)
    templateDownload.js  — генерация и скачивание xlsx шаблонов в браузере
    tecanGwl.js          — генерация .gwl worklist (4 режима), настройки Tecan в localStorage
    cloneCounterImport.js — парсинг JSON из CloneCounter, генерация обратного формата
    backup.js            — экспорт/импорт бэкапа JSON, автосохранение на диск
    ThemeContext.jsx      — React context для светлой/тёмной темы
    theme.js             — хелперы темы (localStorage)
```

## Zustand Store (useStore.js)

**Data** (персистится в localStorage ключ "ct-v4" + автосохранение в файл):
- `experiments[]` — {id, type, name, notes, date}
- `plates[]` — {id, expId, name, format, type, wells, replicates?, layout?, created}
- `transfers[]` — {id, expId, sourceId, targetIds[], type, replicates?, layout?, date}

**Well** — {status, cloneId, sourceWell?, replicateNum?, value?}

**Undo/Redo** — `_past[]`, `_future[]`, max 30 снимков. Shallow copy: `{...e}` для experiments/transfers, `{...p, wells: {...p.wells}}` для plates. Счётчик `_saveCounter` (monotonic) для триггера автосохранения.

**UI state** (не персистится): tab, selExp, selPlate, modal, hovWell, hovClone, transferMode, pendingDelete

**Delete confirmation** — `requestDelete(type, id)` открывает модалку confirmDelete вместо window.confirm. `confirmDelete()` / `cancelDelete()` обрабатывают решение.

**Actions**: createExp, requestDelete/confirmDelete/cancelDelete, createPlate, duplicatePlate, batchWellAction, startTransfer, confirmTransfer (принимает customClones + layout), importAssay, updateWellValue, replaceWells, applyPhotoAnalysis, undo, redo

## Tecan EVO150 интеграция

Настройки Tecan хранятся в `localStorage` (ключ "ct-tecan-config") и редактируются через форму TecanConfigForm (кнопка "Tecan" на табе Планшеты):
- Имена rack'ов: Source96, Dest96, Dest48, Petri
- Объёмы (uL): aspirate, dispense, transfer
- Смена наконечников: always / between_clones / never
- Wash station: да/нет

**4 режима генерации .gwl:**
1. `generatePickingGwl` — пикинг с чашки Петри в 96-well
2. `generatePassageGwl` — штамповка 96->96
3. `generateTransfer96to48Gwl` — перенос 96->48-DWP с репликами
4. `generateFullPipelineGwl` — полный пайплайн (picking + transfer) в одном worklist

## CloneCounter интеграция

Импорт JSON файла из приложения CloneCounter (координаты колоний на чашке Петри). Формат:
```json
{
  "source": "CloneCounter",
  "plate": "Petri_NTG1",
  "date": "2026-03-22",
  "colonies": [
    { "well": "A1", "x": 120, "y": 340, "area": 45, "confidence": 0.95 }
  ]
}
```
Кнопка "CloneCounter" на source plate -> выбор JSON -> парсинг -> применение как picked wells.

## Реализованные фичи

- [x] Декомпозиция монолита на 35+ модулей
- [x] Zustand store с persist + undo/redo (shallow copy, max 30 снимков, _saveCounter)
- [x] Tailwind вместо inline styles
- [x] Светлая / тёмная тема (ThemeContext, переключатель в шапке)
- [x] Drag-selection с batch actions
- [x] Transfer 96->96 и 96->48-DWP с выбором повторностей 2x/3x
- [x] Раскладка повторностей: по строкам (rows) или по столбцам (cols)
- [x] Исключение клонов и изменение порядка при пересеве (drag-and-drop)
- [x] Ручное редактирование клонов на 48-DWP после пересева
- [x] Импорт OD данных (xlsx файл / paste текст) с валидацией
- [x] Интерактивный heatmap (клик = редактировать OD)
- [x] Импорт пикинга из xlsx с отдельными полями WT/Blank
- [x] CloneCounter интеграция (импорт JSON с координатами колоний)
- [x] Фото-анализ 96-well (Canvas, калибровка 4 углов, порог яркости)
- [x] Pipeline визуализация (SVG граф)
- [x] Статистика: survival rate, OD гистограмма, поиск клонов
- [x] Мульти-эксперимент ранкинг
- [x] Экспорт планшета и эксперимента в Excel
- [x] Tecan EVO150: 4 режима .gwl (picking, passage, transfer, full pipeline)
- [x] Tecan EVO150: настраиваемые параметры (rack'и, объёмы, tips, wash)
- [x] Скачивание шаблонов xlsx из приложения
- [x] Этикетки 57x40мм (ч/б, QR-код, мини-карта, паттерны)
- [x] Печать карты планшета на A4
- [x] Бэкап/восстановление базы (JSON) + Ctrl+S для быстрого экспорта
- [x] Автосохранение на диск (Electron IPC, _saveCounter-based, debounce 1.5 сек)
- [x] beforeunload предупреждение при закрытии с данными
- [x] Confirm dialog для удаления (модалка вместо window.confirm)
- [x] Удаление и дублирование отдельных планшетов
- [x] Code splitting (xlsx/qrcode в отдельных chunks)
- [x] Input validation в xlsx parser (размер файла, пустые листы, диапазон значений)
- [x] Portable EXE (Electron + electron-builder)
- [x] 48-DWP лунки прямоугольные (как реальная плашка)
- [x] Drag-and-drop порядка клонов на превью трансфера

## Стиль кода

- Тёмная/светлая тема (переключается кнопкой)
- Тёмная: zinc-950 фон, светлая: white
- JetBrains Mono / Fira Code шрифт
- Зелёные акценты (#10b981 emerald-500)
- Квадратные лунки 96-well, прямоугольные 48-DWP
- Минимум визуального шума
- Русский язык в интерфейсе
- Этикетки — только ч/б (паттерны вместо цветов)

## Сборка

```bash
npm install
npm run build           # Vite build -> dist/
npm run electron:build  # Vite build + Electron portable EXE -> release/CloneTracker.exe
```

Или двойной клик по `build-exe.bat`.

## Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| **Ctrl+Z** | Отменить последнее действие |
| **Ctrl+Shift+Z** / **Ctrl+Y** | Повторить отменённое |
| **Ctrl+S** | Экспорт бэкапа (JSON) |

## Возможные доработки

- SQLite вместо JSON (для >10k клонов)
- Прямой парсинг нативного формата Feyond A400
- PDF-отчёт по эксперименту (для лабораторного журнала / GLP)
- Сетевой режим (общая база для нескольких операторов)
- Аудит-лог (кто, когда, что менял)
- Трекинг колб (flask plate type есть, UI минимален)
