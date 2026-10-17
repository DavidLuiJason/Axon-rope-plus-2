/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Image Editor: multi-picture tray (open many, add, replace, remove), rotate, flip,
 * per-picture edits, undo, redo, reset, and save.
 * Follows THE AXON LOOK strictly.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Crop,
  FlipHorizontal,
  Image as ImageIcon,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Scaling,
  SlidersHorizontal,
  Trash2,
  Type,
  Undo2,
  Wand2,
} from 'lucide-react';
import { ScreenHeader } from '../ScreenHeader';
import { MediaStrip } from './MediaStrip';
import {
  applyOp,
  canRedo,
  canUndo,
  emptyHistory,
  outputSize,
  redo,
  reset,
  undo,
  type EditHistory,
  type EditOp,
} from '../../tools/imageEdit/history';
import {
  activeEntry,
  addPictures,
  emptySet,
  hasPicture as checkHasPicture,
  removePictures,
  replacePicture,
  roomLeft,
  selectPicture,
  setHistory,
  type PictureSet,
} from '../../tools/imageEdit/pictureSet';
import { saveFile } from '../../services/saveFile';

interface ImageEditorScreenProps {
  onBack: () => void;
  onLogoClick?: () => void;
}

type ActivePanel = 'rotate' | 'flip' | 'save' | null;
type SaveFormat = 'png' | 'jpg' | 'webp';
type FilePickerMode = 'open' | 'add' | 'replace';

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${YYYY}${MM}${DD}-${HH}${mm}${ss}`;
}

async function createThumbnail(file: File): Promise<string> {
  const tempBitmap = await createImageBitmap(file);
  const maxDim = Math.max(tempBitmap.width, tempBitmap.height);
  const scale = maxDim > 88 ? 88 / maxDim : 1;
  const tw = Math.max(1, Math.round(tempBitmap.width * scale));
  const th = Math.max(1, Math.round(tempBitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(tempBitmap, 0, 0, tw, th);
  }
  tempBitmap.close();
  return canvas.toDataURL('image/jpeg', 0.8);
}

async function loadBitmapFromFile(
  file: File
): Promise<{ bitmap: ImageBitmap; scaled: boolean }> {
  let loadedBitmap = await createImageBitmap(file);
  let scaled = false;
  const maxDim = Math.max(loadedBitmap.width, loadedBitmap.height);
  if (maxDim > 4096) {
    const ratio = 4096 / maxDim;
    const targetW = Math.round(loadedBitmap.width * ratio);
    const targetH = Math.round(loadedBitmap.height * ratio);

    const offscreen = document.createElement('canvas');
    offscreen.width = targetW;
    offscreen.height = targetH;
    const offCtx = offscreen.getContext('2d');
    if (offCtx) {
      offCtx.drawImage(loadedBitmap, 0, 0, targetW, targetH);
      loadedBitmap.close();
      loadedBitmap = await createImageBitmap(offscreen);
      scaled = true;
    }
  }
  return { bitmap: loadedBitmap, scaled };
}

export const ImageEditorScreen: React.FC<ImageEditorScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const filePickerModeRef = useRef<FilePickerMode>('open');

  // PictureSet (state) and actual File map (keyed by picture id)
  const [pictureSet, setPictureSet] = useState<PictureSet>(emptySet);
  const filesMapRef = useRef<Map<string, File>>(new Map());
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  // Active picture bitmap (Phone safety: only one full-size bitmap kept decoded)
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const [hasPicture, setHasPicture] = useState(false);

  // Active sub-panel
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // Remove mode state
  const [removeMode, setRemoveMode] = useState(false);
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<string[]>([]);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Save format & status
  const [saveFormat, setSaveFormat] = useState<SaveFormat>('png');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'error' | null>(null);

  // Notices
  const [scaledNotice, setScaledNotice] = useState(false);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clean up bitmap on unmount
  useEffect(() => {
    return () => {
      if (bitmapRef.current) {
        bitmapRef.current.close();
        bitmapRef.current = null;
      }
    };
  }, []);

  const active = activeEntry(pictureSet);
  const currentHistory: EditHistory = active ? active.history : emptyHistory();

  // Redraw canvas whenever active bitmap or history ops change
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const bitmap = bitmapRef.current;
    if (!canvas || !bitmap) return;

    const { width: targetWidth, height: targetHeight } = outputSize(
      bitmap.width,
      bitmap.height,
      currentHistory.ops
    );

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, targetWidth, targetHeight);

    let curW = bitmap.width;
    let curH = bitmap.height;

    let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const multiply = (
      m1: { a: number; b: number; c: number; d: number; e: number; f: number },
      m2: { a: number; b: number; c: number; d: number; e: number; f: number }
    ) => ({
      a: m1.a * m2.a + m1.c * m2.b,
      b: m1.b * m2.a + m1.d * m2.b,
      c: m1.a * m2.c + m1.c * m2.d,
      d: m1.b * m2.c + m1.d * m2.d,
      e: m1.a * m2.e + m1.c * m2.f + m1.e,
      f: m1.b * m2.e + m1.d * m2.f + m1.f,
    });

    for (const op of currentHistory.ops) {
      let step = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
      if (op.type === 'rotate') {
        if (op.quarterTurns === 1) {
          step = { a: 0, b: 1, c: -1, d: 0, e: curH, f: 0 };
        } else {
          step = { a: 0, b: -1, c: 1, d: 0, e: 0, f: curW };
        }
        const tmp = curW;
        curW = curH;
        curH = tmp;
      } else if (op.type === 'flip') {
        if (op.axis === 'horizontal') {
          step = { a: -1, b: 0, c: 0, d: 1, e: curW, f: 0 };
        } else {
          step = { a: 1, b: 0, c: 0, d: -1, e: 0, f: curH };
        }
      }
      m = multiply(step, m);
    }

    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.drawImage(bitmap, 0, 0);
    ctx.restore();
  }, [currentHistory.ops]);

  useEffect(() => {
    if (hasPicture) {
      redrawCanvas();
    }
  }, [hasPicture, redrawCanvas]);

  // Handle switching picture selection in the tray
  const handleSelectPicture = async (id: string) => {
    if (id === pictureSet.activeId) return;

    const nextSet = selectPicture(pictureSet, id);
    setPictureSet(nextSet);
    setErrorMessage(null);
    setSaveStatus(null);
    setActivePanel(null);

    if (bitmapRef.current) {
      bitmapRef.current.close();
      bitmapRef.current = null;
    }

    const file = filesMapRef.current.get(id);
    if (file) {
      try {
        const { bitmap, scaled } = await loadBitmapFromFile(file);
        bitmapRef.current = bitmap;
        setScaledNotice(scaled);
      } catch {
        setErrorMessage('That file could not be opened as a picture.');
      }
    }
  };

  // Open file handler (handles Open, Add, Replace)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const selectedFiles = Array.from(fileList);

    // Reset input so picking identical files works
    e.target.value = '';

    setErrorMessage(null);
    setSaveStatus(null);
    const mode = filePickerModeRef.current;

    if (mode === 'replace') {
      const activeEntryItem = activeEntry(pictureSet);
      if (!activeEntryItem) return;

      const file = selectedFiles[0];
      try {
        const { bitmap, scaled } = await loadBitmapFromFile(file);
        if (bitmapRef.current) {
          bitmapRef.current.close();
        }
        bitmapRef.current = bitmap;
        filesMapRef.current.set(activeEntryItem.id, file);

        const thumb = await createThumbnail(file);
        setThumbnails((prev) => ({ ...prev, [activeEntryItem.id]: thumb }));

        const nextSet = replacePicture(pictureSet, activeEntryItem.id, file.name);
        setPictureSet(nextSet);
        setScaledNotice(scaled);
        setActivePanel(null);
      } catch {
        setErrorMessage('That file could not be opened as a picture.');
      }
      return;
    }

    // Open or Add mode
    const names = selectedFiles.map((f) => f.name);
    const isInitial = pictureSet.items.length === 0;
    const { set: nextSet, addedIds, refused } = addPictures(
      pictureSet,
      names,
      isInitial
    );

    if (refused > 0) {
      setLimitNotice('Up to 8 pictures at a time, to keep your phone fast.');
    } else {
      setLimitNotice(null);
    }

    if (addedIds.length === 0) return;

    // Store accepted files into map and create thumbnails
    const newThumbs: Record<string, string> = {};
    for (let i = 0; i < addedIds.length; i++) {
      const id = addedIds[i];
      const file = selectedFiles[i];
      filesMapRef.current.set(id, file);
      try {
        const thumb = await createThumbnail(file);
        newThumbs[id] = thumb;
      } catch {
        // Thumbnail generation failed, fallback handled gracefully
      }
    }
    setThumbnails((prev) => ({ ...prev, ...newThumbs }));

    // If no active bitmap or activeId changed, decode the active one
    const activeTargetId = nextSet.activeId;
    if (activeTargetId && (!bitmapRef.current || isInitial)) {
      if (bitmapRef.current) {
        bitmapRef.current.close();
        bitmapRef.current = null;
      }
      const activeFile = filesMapRef.current.get(activeTargetId);
      if (activeFile) {
        try {
          const { bitmap, scaled } = await loadBitmapFromFile(activeFile);
          bitmapRef.current = bitmap;
          setScaledNotice(scaled);
        } catch {
          setErrorMessage('That file could not be opened as a picture.');
        }
      }
    }

    setPictureSet(nextSet);
    setHasPicture(true);
    setActivePanel(null);
  };

  // Operation dispatch for active picture
  const handleApplyOp = (op: EditOp) => {
    const activeItem = activeEntry(pictureSet);
    if (!activeItem) return;
    const nextHistory = applyOp(activeItem.history, op);
    setPictureSet((prev) => setHistory(prev, activeItem.id, nextHistory));
  };

  const handleUndo = () => {
    const activeItem = activeEntry(pictureSet);
    if (!activeItem || !canUndo(activeItem.history)) return;
    const nextHistory = undo(activeItem.history);
    setPictureSet((prev) => setHistory(prev, activeItem.id, nextHistory));
  };

  const handleRedo = () => {
    const activeItem = activeEntry(pictureSet);
    if (!activeItem || !canRedo(activeItem.history)) return;
    const nextHistory = redo(activeItem.history);
    setPictureSet((prev) => setHistory(prev, activeItem.id, nextHistory));
  };

  const handleReset = () => {
    const activeItem = activeEntry(pictureSet);
    if (!activeItem) return;
    const nextHistory = reset(activeItem.history);
    setPictureSet((prev) => setHistory(prev, activeItem.id, nextHistory));
    setActivePanel(null);
  };

  const togglePanel = (panel: ActivePanel) => {
    if (!hasPicture) return;
    setRemoveMode(false);
    setSelectedRemoveIds([]);
    setConfirmingRemove(false);
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  // Remove mode handlers
  const handleToggleSelectRemove = (id: string) => {
    setSelectedRemoveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleExecuteRemove = async () => {
    const idsToRemove = selectedRemoveIds;
    if (idsToRemove.length === 0) return;

    idsToRemove.forEach((id) => filesMapRef.current.delete(id));
    setThumbnails((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((id) => delete next[id]);
      return next;
    });

    const nextSet = removePictures(pictureSet, idsToRemove);
    setPictureSet(nextSet);
    setSelectedRemoveIds([]);
    setConfirmingRemove(false);
    setRemoveMode(false);
    setLimitNotice(null);

    if (nextSet.items.length === 0 || nextSet.activeId === null) {
      if (bitmapRef.current) {
        bitmapRef.current.close();
        bitmapRef.current = null;
      }
      setHasPicture(false);
      setActivePanel(null);
      setScaledNotice(false);
      return;
    }

    // Decode the new active picture
    if (nextSet.activeId !== pictureSet.activeId || !bitmapRef.current) {
      if (bitmapRef.current) {
        bitmapRef.current.close();
        bitmapRef.current = null;
      }
      const nextFile = filesMapRef.current.get(nextSet.activeId);
      if (nextFile) {
        try {
          const { bitmap, scaled } = await loadBitmapFromFile(nextFile);
          bitmapRef.current = bitmap;
          setScaledNotice(scaled);
        } catch {
          setErrorMessage('That file could not be opened as a picture.');
        }
      }
    }
  };

  // Save handler for active picture
  const handleSavePicture = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasPicture) return;

    setSaveStatus(null);

    let exportCanvas: HTMLCanvasElement = canvas;
    if (saveFormat === 'jpg') {
      exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        ctx.drawImage(canvas, 0, 0);
      }
    }

    const mimeType =
      saveFormat === 'png'
        ? 'image/png'
        : saveFormat === 'jpg'
        ? 'image/jpeg'
        : 'image/webp';
    const quality = saveFormat === 'png' ? undefined : 0.92;

    exportCanvas.toBlob(
      async (blob) => {
        if (!blob) {
          setSaveStatus('error');
          return;
        }
        const stamp = formatTimestamp(new Date());
        const filename = `axon-image-${stamp}.${saveFormat}`;
        const res = await saveFile(filename, blob, mimeType);
        if (res.success) {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus(null), 3000);
        } else {
          setSaveStatus('error');
        }
      },
      mimeType,
      quality
    );
  };

  const stripItems = pictureSet.items.map((p) => ({
    id: p.id,
    name: p.name,
    thumb: thumbnails[p.id],
  }));

  const canAdd = roomLeft(pictureSet) > 0;

  return (
    <div className="relative w-full h-full flex flex-col bg-[#121315] text-[#ECECEC] overflow-hidden font-sans">
      <ScreenHeader
        title="Image Editor"
        tagline="IMAGE EDITOR"
        backLabel="MEDIA"
        collapsible
        onBack={onBack}
        onLogoClick={onLogoClick ?? (() => {})}
      />

      {/* Hidden file input with multiple support */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* A. Action row */}
      <div className="px-5 h-12 flex items-center justify-between border-b border-white/5 bg-[#121315] shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!hasPicture || !canUndo(currentHistory)}
            aria-label="Undo"
            title="Undo"
            className="w-11 h-11 rounded-xl hover:bg-white/5 text-[#D0D2D6] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-colors"
          >
            <Undo2 size={18} />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!hasPicture || !canRedo(currentHistory)}
            aria-label="Redo"
            title="Redo"
            className="w-11 h-11 rounded-xl hover:bg-white/5 text-[#D0D2D6] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-colors"
          >
            <Redo2 size={18} />
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={() => togglePanel('save')}
            disabled={!hasPicture}
            className="px-4 py-2 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>

      {/* B. Work area */}
      <div className="flex-1 min-h-0 bg-[#141517] flex flex-col items-center justify-center p-4 overflow-hidden relative">
        {!hasPicture ? (
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <ImageIcon size={36} className="text-[#5A5C62]" />
            <p className="text-sm text-[#8E9094]">Open a picture to start.</p>
            <button
              type="button"
              onClick={() => {
                filePickerModeRef.current = 'open';
                fileInputRef.current?.click();
              }}
              className="px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer"
            >
              Open picture
            </button>
            <p className="text-[11.5px] text-[#7A7C82]">
              The picture stays on your phone.
            </p>
            {limitNotice && (
              <p className="text-xs text-[#707277] text-center pt-1">
                {limitNotice}
              </p>
            )}
            {errorMessage && (
              <p className="text-[13px] text-[#E0B4A8] pt-1">{errorMessage}</p>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full object-contain"
            />
            {scaledNotice && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-[#141517]/90 border border-white/5 text-[11.5px] text-[#7A7C82] pointer-events-none text-center">
                Large pictures are reduced to 4096 px to keep your phone fast.
              </div>
            )}
          </div>
        )}
      </div>

      {/* C. Bottom area */}
      <div className="shrink-0 bg-[#141517] border-t border-white/5">
        {/* Optional limit notice */}
        {hasPicture && limitNotice && (
          <div className="py-1 px-4 text-center text-xs text-[#707277] border-b border-white/5 bg-[#121315]">
            {limitNotice}
          </div>
        )}

        {/* 1. Tool panel (Rotate / Flip / Save) */}
        {activePanel && hasPicture && !removeMode && (
          <div className="px-5 py-3 border-b border-white/5 flex flex-wrap items-center gap-3">
            {activePanel === 'rotate' && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyOp({ type: 'rotate', quarterTurns: -1 })
                  }
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                >
                  Left 90°
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyOp({ type: 'rotate', quarterTurns: 1 })
                  }
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                >
                  Right 90°
                </button>
              </>
            )}

            {activePanel === 'flip' && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyOp({ type: 'flip', axis: 'horizontal' })
                  }
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                >
                  Horizontal
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyOp({ type: 'flip', axis: 'vertical' })
                  }
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                >
                  Vertical
                </button>
              </>
            )}

            {activePanel === 'save' && (
              <div className="w-full flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#8E9094] mr-1">
                    FORMAT
                  </span>
                  {(['png', 'jpg', 'webp'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setSaveFormat(fmt)}
                      className={`px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer min-h-[44px] ${
                        saveFormat === fmt
                          ? 'bg-white text-black font-medium'
                          : 'bg-white/5 text-[#D0D2D6] hover:bg-white/10'
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSavePicture}
                    className="px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors cursor-pointer min-h-[44px]"
                  >
                    Save picture
                  </button>

                  {saveStatus === 'saved' && (
                    <span className="text-[11.5px] text-[#7A7C82]">Saved.</span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="text-[13px] text-[#E0B4A8]">
                      The picture could not be saved.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Remove action row (appears above the strip in remove mode) */}
        {hasPicture && removeMode && (
          <div className="px-5 py-2.5 border-b border-white/5 flex items-center justify-between min-h-[44px] bg-[#141517]">
            {!confirmingRemove ? (
              <>
                <span className="text-xs text-[#8E9094]">
                  Pick the pictures to remove
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveMode(false);
                      setSelectedRemoveIds([]);
                    }}
                    className="px-3 py-1.5 rounded-xl hover:bg-white/5 text-[#D0D2D6] text-xs font-medium cursor-pointer transition-colors min-h-[36px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedRemoveIds.length === 0}
                    onClick={() => setConfirmingRemove(true)}
                    className="px-3 py-1.5 rounded-xl hover:bg-white/5 text-[#D0D2D6] text-xs font-medium cursor-pointer transition-colors disabled:opacity-30 disabled:pointer-events-none min-h-[36px]"
                  >
                    {selectedRemoveIds.length > 0
                      ? `Remove ${selectedRemoveIds.length}`
                      : 'Remove'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-xs text-[#8E9094]">
                  {selectedRemoveIds.length === 1
                    ? 'Remove 1 picture? Its edits are lost.'
                    : `Remove ${selectedRemoveIds.length} pictures? Their edits are lost.`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingRemove(false)}
                    className="px-3 py-1.5 rounded-xl hover:bg-white/5 text-[#D0D2D6] text-xs font-medium cursor-pointer transition-colors min-h-[36px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteRemove}
                    className="px-3 py-1.5 rounded-xl bg-white text-black font-medium text-xs hover:bg-[#F0F0F0] cursor-pointer transition-colors min-h-[36px]"
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. The picture tray strip (MediaStrip) */}
        {hasPicture && (
          <MediaStrip
            items={stripItems}
            activeId={pictureSet.activeId}
            removeMode={removeMode}
            selectedIds={selectedRemoveIds}
            onSelect={handleSelectPicture}
            onToggleSelect={handleToggleSelectRemove}
            onAdd={() => {
              filePickerModeRef.current = 'add';
              fileInputRef.current?.click();
            }}
            canAdd={canAdd}
          />
        )}

        {/* 4. Tool strip */}
        <div className="px-3 py-2 flex overflow-x-auto gap-1">
          {/* Add */}
          <button
            type="button"
            disabled={!hasPicture || !canAdd}
            onClick={() => {
              filePickerModeRef.current = 'add';
              fileInputRef.current?.click();
            }}
            aria-label="Add picture"
            className="min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 text-[#D0D2D6] disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors shrink-0"
          >
            <Plus size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Add</span>
          </button>

          {/* Replace */}
          <button
            type="button"
            disabled={!hasPicture}
            onClick={() => {
              filePickerModeRef.current = 'replace';
              fileInputRef.current?.click();
            }}
            aria-label="Replace picture"
            className="min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 text-[#D0D2D6] disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors shrink-0"
          >
            <ImageIcon size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Replace</span>
          </button>

          {/* Remove */}
          <button
            type="button"
            disabled={!hasPicture}
            onClick={() => {
              setRemoveMode((prev) => !prev);
              setSelectedRemoveIds([]);
              setConfirmingRemove(false);
              setActivePanel(null);
            }}
            aria-label="Remove pictures"
            className={`min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 cursor-pointer transition-colors shrink-0 ${
              !hasPicture
                ? 'opacity-30 pointer-events-none text-[#5A5C62]'
                : removeMode
                ? 'text-[#E85A3C]'
                : 'text-[#D0D2D6]'
            }`}
          >
            <Trash2 size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Remove</span>
          </button>

          {/* Rotate tool */}
          <button
            type="button"
            disabled={!hasPicture}
            onClick={() => togglePanel('rotate')}
            aria-label="Rotate"
            className={`min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 cursor-pointer transition-colors shrink-0 ${
              !hasPicture
                ? 'opacity-30 pointer-events-none text-[#5A5C62]'
                : activePanel === 'rotate'
                ? 'text-[#E85A3C]'
                : 'text-[#D0D2D6]'
            }`}
          >
            <RotateCw size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Rotate</span>
          </button>

          {/* Flip tool */}
          <button
            type="button"
            disabled={!hasPicture}
            onClick={() => togglePanel('flip')}
            aria-label="Flip"
            className={`min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 cursor-pointer transition-colors shrink-0 ${
              !hasPicture
                ? 'opacity-30 pointer-events-none text-[#5A5C62]'
                : activePanel === 'flip'
                ? 'text-[#E85A3C]'
                : 'text-[#D0D2D6]'
            }`}
          >
            <FlipHorizontal size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Flip</span>
          </button>

          {/* Reset tool */}
          <button
            type="button"
            disabled={!hasPicture}
            onClick={handleReset}
            aria-label="Reset edits"
            className="min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/5 text-[#D0D2D6] disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors shrink-0"
          >
            <RotateCcw size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Reset</span>
          </button>

          {/* Dimmed, not-yet-built items */}
          <div
            className="min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl text-[#5A5C62] cursor-not-allowed shrink-0 select-none"
            aria-disabled="true"
          >
            <Crop size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Crop</span>
          </div>

          <div
            className="min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl text-[#5A5C62] cursor-not-allowed shrink-0 select-none"
            aria-disabled="true"
          >
            <Scaling size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Resize</span>
          </div>

          <div
            className="min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl text-[#5A5C62] cursor-not-allowed shrink-0 select-none"
            aria-disabled="true"
          >
            <SlidersHorizontal size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Adjust</span>
          </div>

          <div
            className="min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl text-[#5A5C62] cursor-not-allowed shrink-0 select-none"
            aria-disabled="true"
          >
            <Wand2 size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Filters</span>
          </div>

          <div
            className="min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl text-[#5A5C62] cursor-not-allowed shrink-0 select-none"
            aria-disabled="true"
          >
            <Type size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Text</span>
          </div>

          <div
            className="min-w-[64px] min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl text-[#5A5C62] cursor-not-allowed shrink-0 select-none"
            aria-disabled="true"
          >
            <Pencil size={20} strokeWidth={1.8} />
            <span className="text-[10.5px] uppercase tracking-wider">Draw</span>
          </div>
        </div>

        {/* Footnote */}
        <p className="text-xs text-[#707277] text-center pb-2">
          Dimmed tools are coming soon.
        </p>
      </div>
    </div>
  );
};

export default ImageEditorScreen;
