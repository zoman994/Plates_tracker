import useStore from "../store/useStore";
import { useTheme } from "../lib/ThemeContext";
import { exportPlate } from "../lib/exportXlsx";
import Btn from "./Btn";

export default function PlateToolbar({ plate, expId, hasData }) {
  const { isDark } = useTheme();
  const setModal = useStore((s) => s.setModal);
  const requestDelete = useStore((s) => s.requestDelete);
  const duplicatePlate = useStore((s) => s.duplicatePlate);

  return (
    <div className={`flex items-center gap-1 mb-2 flex-wrap py-1.5 px-2 rounded ${isDark ? "bg-zinc-900/50" : "bg-zinc-50"}`}>
      {/* Ввод данных */}
      {plate.format === 96 && !hasData && (
        <>
          <span className={`text-[8px] uppercase tracking-wider mr-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>Ввод:</span>
          <Btn small variant="secondary" onClick={() => setModal("cloneCounter")}>CloneCounter</Btn>
          <Btn small variant="secondary" onClick={() => setModal("picking")}>Из Excel</Btn>
          <Btn small variant="secondary" onClick={() => setModal("photo")}>Фото</Btn>
        </>
      )}
      {plate.format === 48 && !hasData && (
        <>
          <span className={`text-[8px] uppercase tracking-wider mr-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>Ввод:</span>
          <Btn small variant="secondary" onClick={() => setModal("assay")}>OD из Excel</Btn>
        </>
      )}
      {plate.format === 48 && (
        <Btn small variant="secondary" onClick={() => setModal("editClones")}>Редактировать клоны</Btn>
      )}

      <span className={`mx-1 ${isDark ? "text-zinc-800" : "text-zinc-300"}`}>|</span>

      {/* Экспорт */}
      <span className={`text-[8px] uppercase tracking-wider mr-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>Экспорт:</span>
      <Btn small variant="secondary" onClick={() => exportPlate(plate, expId)}>Excel</Btn>
      <Btn small variant="secondary" onClick={() => setModal("label")}>Печать</Btn>

      <div className="flex-1" />

      {/* Действия */}
      <Btn small variant="secondary" onClick={() => duplicatePlate(plate.id)}>Копия</Btn>
      <Btn small variant="danger" onClick={() => requestDelete("plate", plate.id)}>Удалить</Btn>
    </div>
  );
}
