# CloneTracker

Десктопное приложение (Electron + React) для учёта клонов при высокопроизводительном скрининге мутантов A. niger. Portable EXE, работает оффлайн.

## Контекст лаборатории

- Организм: Aspergillus niger, штамм ВКПМ F-1064 (pyrG⁺)
- Мутагенез: NTG (нитрозогуанидин), UV, CRISPR, EMS, ARTP
- Масштаб: 500-1000 клонов на раунд
- Скрининг: глюкоамилаза (ДНС-ассей), в будущем другие ферменты
- Оборудование: Tecan EVO150 (EVOware Standard), Feyond A400 ридер
- Формат планшетов: 96-well (8×12) для пикинга/пассажей, 48-DWP (8×6) для культивирования

## Пайплайн клонов

```
Чашка Петри (мутагенез)
  → Пикинг в 96-well (Source plate, S01, S02...)
    → Пассаж 96→96 (Passage plate, P01...)
      → Transfer 96→N×48-DWP (Culture plates, C01, C02..., 2× или 3× повтора)
        → Feyond A400 ридер (OD / ДНС-ассей)
          → Ранкинг по mean повторов, ratio vs WT
            → Топ клоны в колбы
```

## Геометрия 48-DWP

48-well deep-well block = **8 строк × 6 столбцов** (НЕ 6×8!).

### При 3× повторах (15 клонов + WT):
```
     1      2      3      4      5      6
A:  К1.r1  К1.r2  К1.r3  К2.r1  К2.r2  К2.r3
...
H:  К15.r1 К15.r2 К15.r3 WT.r1  WT.r2  WT.r3
```

### При 2× повторах (23 клона + WT):
```
     1      2      3      4      5      6
A:  К1.r1  К1.r2  К2.r1  К2.r2  К3.r1  К3.r2
...
H:  К22.r1 К22.r2 К23.r1 К23.r2 WT.r1  WT.r2
```

Количество клонов на планшет вычисляется: `floor(6 / replicates) * 8 - 1`

## Идентификатор клона

Формат: `{EXPERIMENT}-{PLATE}-{WELL}`, например `NTG1-S01-B7`.
Присваивается при пикинге, **не меняется** при пересадках.

## Техстек

- **Electron 31** — десктопное приложение, portable EXE
- **React 18 + Vite 6** — UI
- **Tailwind CSS 3** — стили
- **Zustand 5** — state management с persist middleware
- **SheetJS (xlsx)** — импорт/экспорт Excel файлов
- **qrcode** — генерация QR-кодов для этикеток
- Автосохранение: localStorage + JSON файл на диске (через Electron IPC)

## Структура проекта

```
electron/
  main.cjs              — Electron main process (IPC: save/load/backup)
  preload.cjs           — contextBridge для file system доступа
src/
  App.jsx               — главный компонент, табы, модалки
  main.jsx              — entry point
  index.css             — Tailwind directives
  components/
    PlateMap.jsx         — SVG plate map с drag-selection (локальный state)
    HeatmapPlate.jsx     — SVG heatmap для OD данных (прямоугольные лунки 48-DWP)
    TransferView.jsx     — dual-panel transfer preview с исключением/порядком клонов
    SourceView.jsx       — мини source plate с highlighting
    RankingTab.jsx       — таблица ранкинга клонов
    AnalysisTab.jsx      — таб "Анализ": выбор планшета, xlsx импорт, интерактивный heatmap с кликом для правки OD
    StatsTab.jsx         — таб "Статистика": поиск клонов, survival rate, OD гистограмма, мульти-эксп ранкинг
    PipelineView.jsx     — SVG граф эксперимента (source→passage→culture)
    PhotoAnalysis.jsx    — анализ фото 96-well: калибровка 4 углов, Canvas pixel analysis
    LabelPrint.jsx       — генерация этикеток 57×40мм (ч/б, QR, мини-карта) + печать A4
    EditClonesModal.jsx  — ручное редактирование клонов на 48-DWP
    Modal.jsx            — модальное окно (wide prop)
    Btn.jsx              — кнопка с вариантами (primary/secondary/danger/ghost)
  forms/
    NewExpForm.jsx       — создание эксперимента
    NewPlateForm.jsx     — создание планшета
    TransferSetup.jsx    — настройка трансфера (выбор повторностей 2×/3×)
    AssayForm.jsx        — импорт OD (xlsx файл или paste текст, скачать шаблон)
    PickingImportForm.jsx — импорт пикинга из xlsx + отдельные поля WT/Blank
    styles.js            — общий Tailwind-класс для input
  store/
    useStore.js          — Zustand store: data + UI + undo/redo (50 шагов) + все actions
  lib/
    geometry.js          — константы (ROWS, COLS, WELL_STATUS, PLATE_TYPES, EXP_TYPES), posToWell, genId, clonesPerPlate
    generate48Layout.js  — раскладка клонов на 48-DWP (параметр replicates: 2 или 3)
    ranking.js           — computeRanking(plates, expId) → {ranked, wtMean, wtN}
    xlsxParser.js        — парсинг xlsx: parseAssayXlsx, parsePickingXlsx
    exportXlsx.js        — экспорт: exportPlate (1 планшет), exportExperiment (все + сводка)
    templateDownload.js  — генерация и скачивание xlsx шаблонов в браузере
    tecanGwl.js          — генерация .gwl worklist для Tecan EVO150
    backup.js            — экспорт/импорт бэкапа JSON, автосохранение на диск
```

## Zustand Store (useStore.js)

**Data** (персистится в localStorage ключ "ct-v4" + автосохранение в файл):
- `experiments[]` — {id, type, name, notes, date}
- `plates[]` — {id, expId, name, format, type, wells, replicates?, created}
- `transfers[]` — {id, expId, sourceId, targetIds[], type, replicates?, date}

**Well** — {status, cloneId, sourceWell?, replicateNum?, value?}

**Undo/Redo** — `_past[]`, `_future[]`, max 50 снимков. Снимок = deep copy {experiments, plates, transfers}.

**UI state** (не персистится): tab, selExp, selPlate, modal, hovWell, hovClone, transferMode

**Actions**: createExp, deleteExp, createPlate, batchWellAction, startTransfer, confirmTransfer (принимает customClones), importAssay, updateWellValue, replaceWells, applyPhotoAnalysis, undo, redo

## Реализованные фичи

- [x] Декомпозиция монолита на 31 модуль
- [x] Zustand store с persist + undo/redo
- [x] Tailwind вместо inline styles
- [x] Drag-selection с batch actions
- [x] Transfer 96→96 и 96→48-DWP с выбором повторностей 2×/3×
- [x] Исключение клонов и изменение порядка при пересеве
- [x] Ручное редактирование клонов на 48-DWP после пересева
- [x] Импорт OD данных (xlsx файл / paste текст)
- [x] Интерактивный heatmap (клик = редактировать OD)
- [x] Импорт пикинга из xlsx с отдельными полями WT/Blank
- [x] Фото-анализ 96-well (Canvas, калибровка 4 углов, порог яркости)
- [x] Pipeline визуализация (SVG граф)
- [x] Статистика: survival rate, OD гистограмма, поиск клонов
- [x] Мульти-эксперимент ранкинг
- [x] Экспорт планшета и эксперимента в Excel
- [x] Генерация .gwl worklist для Tecan EVO150
- [x] Скачивание шаблонов xlsx из приложения
- [x] Этикетки 57×40мм (ч/б, QR-код, мини-карта, паттерны)
- [x] Печать карты планшета на A4
- [x] Бэкап/восстановление базы (JSON)
- [x] Автосохранение на диск (Electron IPC, clonetracker-data.json)
- [x] Portable EXE (Electron + electron-builder)
- [x] 48-DWP лунки прямоугольные (как реальная плашка)

## Стиль кода

- Тёмная тема (zinc-950 фон)
- JetBrains Mono / Fira Code шрифт
- Зелёные акценты (#10b981 emerald-500)
- Квадратные лунки 96-well, прямоугольные 48-DWP
- Минимум визуального шума
- Русский язык в интерфейсе
- Этикетки — только ч/б (паттерны вместо цветов)

## Сборка

```bash
npm install
npm run build           # Vite build → dist/
npm run electron:build  # Vite build + Electron portable EXE → release/CloneTracker.exe
```

Или двойной клик по `build-exe.bat`.

## Возможные доработки

- SQLite вместо JSON (для >10k клонов)
- Прямой парсинг нативного формата Feyond A400
- PDF-отчёт по эксперименту (для лабораторного журнала / GLP)
- Сетевой режим (общая база для нескольких операторов)
- Аудит-лог (кто, когда, что менял)
- Трекинг колб (flask plate type есть, UI минимален)
