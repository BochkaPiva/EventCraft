import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  ArrowLeft,
  Undo2,
  RotateCcw,
  RotateCw,
  Trash2,
  Plus,
  Move,
  Box,
  Footprints,
  LayoutGrid,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Save,
  Info,
} from "lucide-react";
import {
  hall,
  furniture,
  createDefaultScene,
  seatCount,
  validatePlacement,
  findPlacement,
  normalizedRotation,
  isWalkable,
} from "./sceneModel.js";
import "./spatial.css";

const rounded = (value) => Math.round(value * 100) / 100;

function disposeObject(object) {
  const materials = new Set();
  object.traverse((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material))
      child.material.forEach((material) => materials.add(material));
    else if (child.material) materials.add(child.material);
  });
  materials.forEach((material) => material.dispose());
}

function mesh(geometry, color, x, y, z, parent, options = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.75,
    ...options,
  });
  const result = new THREE.Mesh(geometry, material);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function addChair(parent, x, z, rotation = 0) {
  const chair = new THREE.Group();
  chair.position.set(x, 0, z);
  chair.rotation.y = rotation;
  mesh(new THREE.BoxGeometry(0.4, 0.08, 0.42), "#64748b", 0, 0.45, 0, chair);
  mesh(new THREE.BoxGeometry(0.4, 0.4, 0.06), "#64748b", 0, 0.69, 0.19, chair);
  for (const dx of [-0.15, 0.15])
    for (const dz of [-0.15, 0.15])
      mesh(
        new THREE.BoxGeometry(0.035, 0.42, 0.035),
        "#475569",
        dx,
        0.22,
        dz,
        chair,
      );
  parent.add(chair);
}

function buildFurniture(items, parent) {
  for (const item of items) {
    const object = new THREE.Group();
    object.position.set(item.x, 0, item.z);
    object.rotation.y = (-(item.rotation || 0) * Math.PI) / 180;
    if (item.type === "roundTable") {
      mesh(
        new THREE.CylinderGeometry(0.76, 0.76, 0.08, 32),
        "#f8fafc",
        0,
        0.76,
        0,
        object,
      );
      mesh(
        new THREE.CylinderGeometry(0.13, 0.24, 0.7, 12),
        "#9ca3af",
        0,
        0.36,
        0,
        object,
      );
      for (let index = 0; index < 8; index++) {
        const angle = (index * Math.PI) / 4;
        addChair(object, Math.sin(angle) * 0.87, Math.cos(angle) * 0.87, angle);
      }
      mesh(
        new THREE.CylinderGeometry(0.09, 0.07, 0.18, 10),
        "#94a3b8",
        0,
        0.88,
        0,
        object,
      );
    } else if (item.type === "banquetTable") {
      mesh(
        new THREE.BoxGeometry(2.05, 0.08, 0.85),
        "#f8fafc",
        0,
        0.76,
        0,
        object,
      );
      for (const x of [-0.8, 0.8])
        for (const z of [-0.3, 0.3])
          mesh(
            new THREE.BoxGeometry(0.07, 0.73, 0.07),
            "#94a3b8",
            x,
            0.37,
            z,
            object,
          );
      for (const x of [-0.7, 0, 0.7]) {
        addChair(object, x, 0.65);
        addChair(object, x, -0.65, Math.PI);
      }
    } else if (item.type === "chair") {
      addChair(object, 0, 0);
    } else if (item.type === "stage") {
      mesh(
        new THREE.BoxGeometry(item.width, 0.45, item.depth),
        "#6366a0",
        0,
        0.225,
        0,
        object,
      );
      mesh(
        new THREE.BoxGeometry(item.width - 0.06, 0.025, item.depth - 0.06),
        "#8186b9",
        0,
        0.46,
        0,
        object,
      );
    } else if (item.type === "dancefloor") {
      mesh(
        new THREE.BoxGeometry(item.width, 0.035, item.depth),
        "#d8bd89",
        0,
        0.025,
        0,
        object,
      );
    }
    parent.add(object);
  }
}

function ThreeView({ scene, mode, onNotice }) {
  const hostRef = useRef(null);
  const runtimeRef = useRef(null);
  const sceneRef = useRef(scene);
  const controlRef = useRef(null);
  const [error, setError] = useState("");
  const noticeRef = useRef(onNotice);
  noticeRef.current = onNotice;
  sceneRef.current = scene;

  useEffect(() => {
    const host = hostRef.current;
    let renderer;
    let controls;
    let observer;
    let disposed = false;
    const keys = new Set();
    const world = new THREE.Scene();
    world.background = new THREE.Color("#edf1f5");
    const camera = new THREE.PerspectiveCamera(
      mode === "walk" ? 68 : 43,
      1,
      0.05,
      100,
    );
    const contents = new THREE.Group();
    world.add(contents);
    let yaw = 0,
      pitch = 0,
      looking = null;

    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2", {
        antialias: true,
        alpha: false,
      });
      if (!context) throw new Error("WebGL2 недоступен");
      renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute(
        "aria-label",
        mode === "walk"
          ? "Прогулка по учебному залу. WASD или стрелки для движения, перетаскивание для обзора."
          : "Объёмный вид учебного зала. Перетаскивание вращает камеру.",
      );
      host.appendChild(renderer.domElement);
      setError("");
    } catch {
      setError(
        "Объёмный вид недоступен в этом браузере. План и ваши изменения сохранены — переключитесь на «План».",
      );
      return () => {
        disposed = true;
        renderer?.dispose();
        renderer?.domElement?.remove();
      };
    }

    world.add(new THREE.HemisphereLight("#ffffff", "#8b97a8", 2.5));
    const light = new THREE.DirectionalLight("#fff5e5", 2.3);
    light.position.set(5, 15, 7);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, {
      left: -12,
      right: 12,
      top: 12,
      bottom: -12,
      near: 0.1,
      far: 40,
    });
    world.add(light);
    mesh(
      new THREE.BoxGeometry(hall.width, 0.12, hall.depth),
      "#e1ddd6",
      8,
      -0.07,
      6,
      world,
    );
    const wallOpacity = mode === "walk" ? 1 : 0.27;
    const wallOptions = { transparent: wallOpacity < 1, opacity: wallOpacity };
    mesh(
      new THREE.BoxGeometry(16.2, 3.6, 0.12),
      "#e2e7ed",
      8,
      1.8,
      0,
      world,
      wallOptions,
    );
    mesh(
      new THREE.BoxGeometry(0.12, 3.6, 12),
      "#e2e7ed",
      0,
      1.8,
      6,
      world,
      wallOptions,
    );
    mesh(
      new THREE.BoxGeometry(0.12, 3.6, 12),
      "#e2e7ed",
      16,
      1.8,
      6,
      world,
      wallOptions,
    );
    mesh(
      new THREE.BoxGeometry(6.9, 3.6, 0.12),
      "#e2e7ed",
      3.45,
      1.8,
      12,
      world,
      wallOptions,
    );
    mesh(
      new THREE.BoxGeometry(6.9, 3.6, 0.12),
      "#e2e7ed",
      12.55,
      1.8,
      12,
      world,
      wallOptions,
    );
    for (const column of hall.columns)
      mesh(
        new THREE.BoxGeometry(column.width, 3.6, column.depth),
        "#a4aebc",
        column.x,
        1.8,
        column.z,
        world,
      );
    for (const x of [2, 5, 11, 14])
      mesh(
        new THREE.BoxGeometry(1.7, 1.35, 0.035),
        "#c5dceb",
        x,
        1.95,
        0.075,
        world,
      );
    buildFurniture(sceneRef.current.items, contents);

    function setWalkCamera() {
      camera.rotation.order = "YXZ";
      camera.rotation.set(pitch, yaw, 0);
    }
    function walk(dx, dz) {
      const x = camera.position.x + dx * Math.cos(yaw) + dz * Math.sin(yaw);
      const z = camera.position.z - dx * Math.sin(yaw) + dz * Math.cos(yaw);
      if (isWalkable(x, camera.position.z, sceneRef.current))
        camera.position.x = x;
      if (isWalkable(camera.position.x, z, sceneRef.current))
        camera.position.z = z;
    }
    function keydown(event) {
      if (!host.contains(document.activeElement)) return;
      const key = event.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(key)
      ) {
        event.preventDefault();
        keys.add(key);
      }
    }
    const keyup = (event) => keys.delete(event.key.toLowerCase());
    const blur = () => {
      keys.clear();
      looking = null;
    };
    function pointerdown(event) {
      if (mode !== "walk") return;
      renderer.domElement.focus();
      looking = { x: event.clientX, y: event.clientY, id: event.pointerId };
      renderer.domElement.setPointerCapture(event.pointerId);
    }
    function pointermove(event) {
      if (!looking) return;
      yaw -= (event.clientX - looking.x) * 0.005;
      pitch = Math.max(
        -0.8,
        Math.min(0.8, pitch - (event.clientY - looking.y) * 0.004),
      );
      looking.x = event.clientX;
      looking.y = event.clientY;
      setWalkCamera();
    }
    const pointerup = () => {
      looking = null;
    };
    if (mode === "walk") {
      camera.position.set(hall.entrance.x, 1.65, hall.entrance.z);
      setWalkCamera();
      window.addEventListener("keydown", keydown);
      window.addEventListener("keyup", keyup);
      window.addEventListener("blur", blur);
      renderer.domElement.addEventListener("pointerdown", pointerdown);
      renderer.domElement.addEventListener("pointermove", pointermove);
      renderer.domElement.addEventListener("pointerup", pointerup);
      renderer.domElement.addEventListener("pointercancel", pointerup);
    } else {
      camera.position.set(20, 18, 21);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(8, 0.2, 6);
      controls.enableDamping = true;
      controls.minDistance = 8;
      controls.maxDistance = 36;
      controls.maxPolarAngle = Math.PI / 2.12;
      controls.update();
    }
    controlRef.current = {
      step: (dx, dz) => walk(dx, dz),
      turn: (amount) => {
        yaw += amount;
        setWalkCamera();
      },
      hold: (key, active) => (active ? keys.add(key) : keys.delete(key)),
      reset: () => {
        camera.position.set(hall.entrance.x, 1.65, hall.entrance.z);
        yaw = 0;
        pitch = 0;
        setWalkCamera();
      },
    };
    const resize = () => {
      if (disposed) return;
      const width = Math.max(host.clientWidth, 1),
        height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(resize);
      observer.observe(host);
    }
    window.addEventListener("resize", resize);
    resize();
    let previous = performance.now();
    renderer.setAnimationLoop((now) => {
      if (disposed) return;
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      if (mode === "walk") {
        let x = 0,
          z = 0;
        if (keys.has("w") || keys.has("arrowup")) z -= 1;
        if (keys.has("s") || keys.has("arrowdown")) z += 1;
        if (keys.has("a") || keys.has("arrowleft")) x -= 1;
        if (keys.has("d") || keys.has("arrowright")) x += 1;
        const length = Math.hypot(x, z);
        if (length) walk((x / length) * dt * 2.4, (z / length) * dt * 2.4);
      } else controls.update();
      renderer.render(world, camera);
    });
    runtimeRef.current = { contents, camera, mode };
    return () => {
      disposed = true;
      runtimeRef.current = null;
      controlRef.current = null;
      renderer.setAnimationLoop(null);
      observer?.disconnect();
      controls?.dispose();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      renderer.domElement.removeEventListener("pointerdown", pointerdown);
      renderer.domElement.removeEventListener("pointermove", pointermove);
      renderer.domElement.removeEventListener("pointerup", pointerup);
      renderer.domElement.removeEventListener("pointercancel", pointerup);
      disposeObject(world);
      light.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [mode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    disposeObject(runtime.contents);
    runtime.contents.clear();
    buildFurniture(scene.items, runtime.contents);
    if (
      mode === "walk" &&
      !isWalkable(runtime.camera.position.x, runtime.camera.position.z, scene)
    ) {
      controlRef.current?.reset();
      noticeRef.current?.("Расстановка изменилась. Прогулка начата у входа.");
    }
  }, [scene, mode]);

  return (
    <div className="spatial-three-wrap">
      <div className="spatial-three" ref={hostRef} />
      {error && (
        <div className="spatial-webgl-error" role="status">
          <Info size={24} />
          <p>{error}</p>
        </div>
      )}
      {!error && mode === "walk" && (
        <>
          <div className="spatial-walk-help">
            WASD / стрелки — движение · потяните для обзора
          </div>
          <div
            className="spatial-walk-controls"
            aria-label="Управление прогулкой"
          >
            <button
              type="button"
              aria-label="Посмотреть влево"
              onClick={() => controlRef.current?.turn(0.2)}
            >
              <RotateCcw size={18} />
            </button>
            <button
              type="button"
              aria-label="Шаг вперёд"
              onClick={() => controlRef.current?.step(0, -0.4)}
            >
              <ChevronUp size={22} />
            </button>
            <button
              type="button"
              aria-label="Посмотреть вправо"
              onClick={() => controlRef.current?.turn(-0.2)}
            >
              <RotateCw size={18} />
            </button>
            <button
              type="button"
              aria-label="Шаг влево"
              onClick={() => controlRef.current?.step(-0.4, 0)}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              aria-label="Шаг назад"
              onClick={() => controlRef.current?.step(0, 0.4)}
            >
              <ChevronDown size={22} />
            </button>
            <button
              type="button"
              aria-label="Шаг вправо"
              onClick={() => controlRef.current?.step(0.4, 0)}
            >
              <ChevronRight size={22} />
            </button>
          </div>
          <button
            type="button"
            className="spatial-walk-reset"
            onClick={() => controlRef.current?.reset()}
          >
            Ко входу
          </button>
        </>
      )}
      {!error && mode === "volume" && (
        <div className="spatial-orbit-help">
          Потяните, чтобы осмотреть · колесо — приблизить
        </div>
      )}
    </div>
  );
}

function PlanItem({ item, index, selected, ghost, invalid, onPointerDown }) {
  const meta = furniture[item.type];
  if (!meta) return null;
  const stroke = invalid ? "#dc2626" : selected ? "#4f46e5" : "#94a3b8";
  return (
    <g
      transform={`translate(${item.x} ${item.z}) rotate(${item.rotation || 0})`}
      className={`spatial-plan-item ${selected ? "is-selected" : ""} ${ghost ? "is-ghost" : ""}`}
      onPointerDown={onPointerDown}
    >
      <title>{`${meta.label} ${index + 1}, ${meta.seats ? `${meta.seats} мест` : `${item.width} × ${item.depth} м`}`}</title>
      {selected && (
        <rect
          x={-item.width / 2 - 0.09}
          y={-item.depth / 2 - 0.09}
          width={item.width + 0.18}
          height={item.depth + 0.18}
          rx="0.12"
          fill="#eef2ff"
          stroke={stroke}
          strokeWidth="0.035"
          strokeDasharray="0.09 0.06"
        />
      )}
      {item.type === "roundTable" ? (
        <>
          {Array.from({ length: 8 }, (_, seat) => {
            const angle = (seat * Math.PI) / 4;
            return (
              <rect
                key={seat}
                x={-0.19}
                y={-0.19}
                width="0.38"
                height="0.38"
                rx="0.075"
                transform={`translate(${Math.sin(angle) * 0.87} ${Math.cos(angle) * 0.87}) rotate(${-seat * 45})`}
                fill="#b9c5d6"
                stroke="#8b9bb0"
                strokeWidth="0.02"
              />
            );
          })}
          <circle
            r="0.73"
            fill={invalid ? "#fee2e2" : "#ffffff"}
            stroke={stroke}
            strokeWidth="0.035"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="0.25"
            fill="#475569"
            pointerEvents="none"
          >
            {index + 1}
          </text>
        </>
      ) : item.type === "banquetTable" ? (
        <>
          {[-0.75, 0, 0.75].flatMap((x, index) =>
            [-0.68, 0.68].map((z, side) => (
              <rect
                key={`${index}-${side}`}
                x={x - 0.18}
                y={z - 0.18}
                width="0.36"
                height="0.36"
                rx="0.06"
                fill="#b9c5d6"
              />
            )),
          )}
          <rect
            x="-1.02"
            y="-0.42"
            width="2.04"
            height="0.84"
            rx="0.08"
            fill="white"
            stroke={stroke}
            strokeWidth="0.035"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="0.23"
            fill="#475569"
          >
            6 мест
          </text>
        </>
      ) : (
        <>
          <rect
            x={-item.width / 2}
            y={-item.depth / 2}
            width={item.width}
            height={item.depth}
            rx={item.type === "chair" ? 0.07 : 0.05}
            fill={invalid ? "#fee2e2" : meta.color}
            stroke={stroke}
            strokeWidth="0.035"
          />
          {item.type !== "chair" && (
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="0.25"
              fill="#3f4763"
            >
              {meta.label}
            </text>
          )}
        </>
      )}
    </g>
  );
}

function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 0.1,
  suffix = "м",
}) {
  const [draft, setDraft] = useState(String(value));
  const cancelRef = useRef(false);
  useEffect(() => setDraft(String(rounded(value))), [value]);
  return (
    <label className="spatial-number-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          value={draft}
          min={min}
          max={max}
          step={step}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const number = draft.trim() === "" ? NaN : Number(draft);
            if (
              !cancelRef.current &&
              Number.isFinite(number) &&
              number !== value
            )
              onCommit(number);
            cancelRef.current = false;
            setDraft(String(rounded(value)));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.stopPropagation();
              cancelRef.current = true;
              setDraft(String(value));
              event.currentTarget.blur();
            }
          }}
        />
        <span>{suffix}</span>
      </div>
    </label>
  );
}

export default function SpatialEditor({
  scene,
  onChange,
  onClose,
  onUndo,
  canUndo = false,
  readOnly = false,
  title,
  onSaveVariant,
}) {
  const fallbackScene = useRef(null);
  if (!fallbackScene.current) fallbackScene.current = createDefaultScene();
  const current = scene?.items ? scene : fallbackScene.current;
  const currentRef = useRef(current);
  currentRef.current = current;
  const [mode, setMode] = useState("plan");
  const [selectedId, setSelectedId] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [notice, setNotice] = useState(
    "Выберите предмет на плане или добавьте мебель с полки.",
  );
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const selected = current.items.find((item) => item.id === selectedId);
  const seats = seatCount(current);
  const expected = Number(current.expectedGuests || current.guestCount || 0);
  const selectedMeta = selected ? furniture[selected.type] : null;

  useEffect(() => {
    if (selectedId && !current.items.some((item) => item.id === selectedId))
      setSelectedId(null);
  }, [current, selectedId]);
  useEffect(() => {
    if (readOnly) {
      dragRef.current = null;
      setGhost(null);
    }
  }, [readOnly]);

  function commitItem(item, message) {
    if (readOnly || !onChange) return false;
    const validation = validatePlacement(item, currentRef.current);
    if (!validation.valid) {
      setNotice(validation.message);
      return false;
    }
    onChange({
      ...currentRef.current,
      items: currentRef.current.items.map((existing) =>
        existing.id === item.id ? item : existing,
      ),
    });
    setNotice(
      message || "Расстановка изменена. Камеры используют этот же план.",
    );
    return true;
  }
  function patchSelected(patch, message) {
    const item = currentRef.current.items.find(
      (existing) => existing.id === selectedId,
    );
    if (!item) return;
    commitItem({ ...item, ...patch }, message);
  }
  function addItem(type, position) {
    if (readOnly || !onChange) return;
    let item;
    if (position) {
      const meta = furniture[type];
      item = {
        id: `item-${crypto.randomUUID()}`,
        type,
        ...position,
        width: meta.width,
        depth: meta.depth,
        rotation: 0,
      };
      const validation = validatePlacement(item, currentRef.current);
      if (!validation.valid) {
        setNotice(`Не добавлено. ${validation.message}`);
        return;
      }
    } else item = findPlacement(type, currentRef.current);
    if (!item) {
      setNotice(
        "Свободного места для этого предмета не найдено. Освободите часть зала.",
      );
      return;
    }
    onChange({
      ...currentRef.current,
      items: [...currentRef.current.items, item],
    });
    setSelectedId(item.id);
    setNotice(
      `${furniture[type].label} добавлен. Переместите его или задайте положение.`,
    );
  }
  function removeSelected() {
    if (readOnly || !selected) return;
    onChange?.({
      ...currentRef.current,
      items: currentRef.current.items.filter((item) => item.id !== selectedId),
    });
    setSelectedId(null);
    setNotice("Предмет возвращён на полку. Действие можно отменить.");
  }
  function svgPosition(event) {
    const svg = svgRef.current;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, z: 0 };
    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, z: transformed.y };
  }
  function startDrag(event, item) {
    event.stopPropagation();
    setSelectedId(item.id);
    svgRef.current?.focus();
    if (readOnly || event.button !== 0) return;
    const pointer = svgPosition(event);
    dragRef.current = {
      item: { ...item },
      offsetX: pointer.x - item.x,
      offsetZ: pointer.z - item.z,
      moved: false,
      candidate: item,
    };
    svgRef.current.setPointerCapture(event.pointerId);
  }
  function moveDrag(event) {
    const drag = dragRef.current;
    if (!drag) return;
    const pointer = svgPosition(event);
    const item = {
      ...drag.item,
      x: rounded(Math.round((pointer.x - drag.offsetX) * 10) / 10),
      z: rounded(Math.round((pointer.z - drag.offsetZ) * 10) / 10),
    };
    drag.moved =
      drag.moved ||
      Math.hypot(item.x - drag.item.x, item.z - drag.item.z) > 0.04;
    drag.candidate = item;
    if (drag.moved) setGhost(item);
  }
  function finishDrag() {
    const drag = dragRef.current;
    dragRef.current = null;
    setGhost(null);
    if (!drag?.moved || readOnly) return;
    const validation = validatePlacement(drag.candidate, currentRef.current);
    if (validation.valid)
      commitItem(
        drag.candidate,
        "Предмет перемещён. Количество мест не изменилось.",
      );
    else
      setNotice(`${validation.message}. Предмет возвращён на прежнее место.`);
  }
  function cancelDrag() {
    dragRef.current = null;
    setGhost(null);
  }
  function keydown(event) {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
    if (event.key === "Escape") {
      cancelDrag();
      setSelectedId(null);
      return;
    }
    if (readOnly) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (canUndo) onUndo?.();
      return;
    }
    if (!selected || mode !== "plan") return;
    const step = event.shiftKey ? 0.5 : 0.1;
    const deltas = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (deltas[event.key]) {
      event.preventDefault();
      patchSelected({
        x: rounded(selected.x + deltas[event.key][0]),
        z: rounded(selected.z + deltas[event.key][1]),
      });
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeSelected();
    }
  }
  const ghostValidation = ghost ? validatePlacement(ghost, current) : null;

  return (
    <section
      className="spatial-editor"
      aria-label="Редактор расстановки"
      onKeyDown={keydown}
    >
      <header className="spatial-topbar">
        <button type="button" className="spatial-back" onClick={onClose}>
          <ArrowLeft size={17} />
          <span>Вернуться в КП</span>
        </button>
        <div className="spatial-title">
          <strong>{title || hall.name}</strong>
          <span>Учебный зал · 16 × 12 м</span>
        </div>
        <div className="spatial-mode-tabs" aria-label="Вид пространства">
          {[
            ["plan", LayoutGrid, "План"],
            ["volume", Box, "Объём"],
            ["walk", Footprints, "Прогулка"],
          ].map(([value, Icon, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={mode === value}
              className={mode === value ? "is-active" : ""}
              onClick={() => {
                cancelDrag();
                setMode(value);
              }}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="spatial-top-actions">
          {!readOnly && (
            <button
              type="button"
              className="spatial-button"
              disabled={!canUndo || !onUndo}
              onClick={() => {
                cancelDrag();
                onUndo?.();
              }}
              title="Отменить последнее изменение расстановки"
            >
              <Undo2 size={16} />
              <span>Отменить</span>
            </button>
          )}
          {!readOnly && onSaveVariant && (
            <button
              type="button"
              className="spatial-button spatial-primary"
              aria-label="Сохранить вариант"
              title="Сохранить вариант"
              onClick={() => onSaveVariant(current)}
            >
              <Save size={16} />
              <span>Сохранить вариант</span>
            </button>
          )}
        </div>
      </header>
      <div className="spatial-workspace">
        <aside className="spatial-library" aria-label="Полка мебели">
          <div className="spatial-panel-heading">
            <strong>
              {readOnly ? "Состав расстановки" : "Добавить в зал"}
            </strong>
            <span>
              {readOnly ? "Только просмотр" : "Нажмите или перетащите"}
            </span>
          </div>
          {readOnly ? (
            <div className="spatial-readonly-note">
              Это отправленная расстановка. Для изменений создайте свой вариант
              в КП.
            </div>
          ) : (
            <div className="spatial-shelf">
              {Object.entries(furniture).map(([type, meta]) => (
                <button
                  type="button"
                  key={type}
                  className="spatial-shelf-item"
                  draggable
                  onClick={() => addItem(type)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/x-eventcraft-furniture",
                      type,
                    );
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <span
                    className={`spatial-furniture-symbol spatial-symbol-${type}`}
                    aria-hidden="true"
                  >
                    <Plus size={14} />
                  </span>
                  <span>
                    <strong>{meta.label}</strong>
                    <small>{meta.description}</small>
                  </span>
                  <Plus size={15} />
                </button>
              ))}
            </div>
          )}
          <div className="spatial-object-list">
            <div className="spatial-panel-heading">
              <strong>На плане</strong>
              <span>{current.items.length} предметов</span>
            </div>
            {current.items.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={selectedId === item.id ? "is-selected" : ""}
                onClick={() => {
                  setSelectedId(item.id);
                  setMode("plan");
                }}
              >
                <span>
                  {furniture[item.type]?.label || "Предмет"}{" "}
                  {item.type === "roundTable" ? index + 1 : ""}
                </span>
                <span>
                  {furniture[item.type]?.seats
                    ? `${furniture[item.type].seats} мест`
                    : ""}
                </span>
              </button>
            ))}
          </div>
          <p className="spatial-synthetic-note">
            Демонстрационная геометрия. Размещение не бронирует мебель.
          </p>
        </aside>
        <main className="spatial-canvas-column">
          <div className="spatial-canvas-toolbar">
            <span>
              {mode === "plan"
                ? readOnly
                  ? "План расстановки"
                  : "Выберите предмет, чтобы изменить"
                : mode === "walk"
                  ? "Свободная прогулка"
                  : "Объёмный вид"}
              {mode !== "plan" && " · мебель не перемещается"}
            </span>
            <div
              className={`spatial-seats ${seats < expected ? "needs-review" : ""}`}
            >
              <strong>{seats}</strong> мест{" "}
              <span>
                {expected
                  ? `/ ${expected} гостей`
                  : "· число гостей пока не задано"}
              </span>
            </div>
          </div>
          <div className="spatial-canvas-area">
            {mode === "plan" ? (
              <svg
                ref={svgRef}
                className="spatial-plan"
                viewBox="-0.85 -0.85 17.7 13.7"
                role="application"
                aria-label="План учебного зала. Выберите предмет. Стрелки перемещают, Delete возвращает на полку."
                tabIndex={0}
                onPointerDown={() => setSelectedId(null)}
                onPointerMove={moveDrag}
                onPointerUp={finishDrag}
                onPointerCancel={cancelDrag}
                onDragOver={(event) => {
                  if (!readOnly) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (readOnly) return;
                  const type = event.dataTransfer.getData(
                    "application/x-eventcraft-furniture",
                  );
                  if (furniture[type]) addItem(type, svgPosition(event));
                }}
              >
                <defs>
                  <pattern
                    id="spatial-grid"
                    width="0.5"
                    height="0.5"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M .5 0 L 0 0 0 .5"
                      fill="none"
                      stroke="#e6eaf0"
                      strokeWidth="0.012"
                    />
                  </pattern>
                </defs>
                <rect
                  x="0"
                  y="0"
                  width="16"
                  height="12"
                  rx="0.025"
                  fill="#fbfcfe"
                  stroke="#778599"
                  strokeWidth="0.07"
                />
                <rect width="16" height="12" fill="url(#spatial-grid)" />
                <rect
                  x="6.9"
                  y="11.95"
                  width="2.2"
                  height="0.12"
                  fill="#f8fafc"
                />
                <text
                  x="8"
                  y="12.47"
                  textAnchor="middle"
                  fontSize="0.22"
                  fill="#64748b"
                >
                  Вход
                </text>
                <text
                  x="8"
                  y="-0.35"
                  textAnchor="middle"
                  fontSize="0.23"
                  fill="#64748b"
                >
                  16 м
                </text>
                <text
                  x="-0.4"
                  y="6"
                  textAnchor="middle"
                  fontSize="0.23"
                  fill="#64748b"
                  transform="rotate(-90 -.4 6)"
                >
                  12 м
                </text>
                {hall.columns.map((column) => (
                  <g key={column.id}>
                    <rect
                      x={column.x - column.width / 2}
                      y={column.z - column.depth / 2}
                      width={column.width}
                      height={column.depth}
                      fill="#8e9bad"
                      stroke="#738197"
                      strokeWidth="0.025"
                    />
                    <title>Неподвижная колонна</title>
                  </g>
                ))}
                {current.items.map((item, index) => (
                  <PlanItem
                    key={item.id}
                    item={item}
                    index={index}
                    selected={selectedId === item.id}
                    onPointerDown={(event) => startDrag(event, item)}
                  />
                ))}
                {ghost && (
                  <g pointerEvents="none">
                    <PlanItem
                      item={ghost}
                      index={current.items.findIndex(
                        (item) => item.id === ghost.id,
                      )}
                      selected
                      ghost
                      invalid={!ghostValidation.valid}
                    />
                  </g>
                )}
              </svg>
            ) : (
              <ThreeView scene={current} mode={mode} onNotice={setNotice} />
            )}
            {ghost && !ghostValidation.valid && (
              <div className="spatial-drag-warning">
                {ghostValidation.message}
              </div>
            )}
          </div>
          <footer className="spatial-status" role="status" aria-live="polite">
            <Info size={15} />
            <span>{notice}</span>
            {seats < expected && (
              <strong>Не хватает {expected - seats} мест</strong>
            )}
          </footer>
        </main>
        <aside className="spatial-properties" aria-label="Свойства предмета">
          {selected ? (
            <>
              <div className="spatial-panel-heading">
                <strong>{selectedMeta.label}</strong>
                <span>{selectedMeta.description}</span>
              </div>
              {readOnly || mode !== "plan" ? (
                <div className="spatial-static-properties">
                  <p>
                    Размеры: {selected.width} × {selected.depth} м
                  </p>
                  <p>Поворот: {selected.rotation}°</p>
                  <p>Мест: {selectedMeta.seats || "—"}</p>
                  {!readOnly && (
                    <button type="button" onClick={() => setMode("plan")}>
                      Изменить на плане
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="spatial-property-section">
                    <strong>Положение в зале</strong>
                    <div className="spatial-field-row">
                      <NumberField
                        key={`${selected.id}-x`}
                        label="По горизонтали"
                        value={selected.x}
                        onCommit={(x) => patchSelected({ x })}
                      />
                      <NumberField
                        key={`${selected.id}-z`}
                        label="По вертикали"
                        value={selected.z}
                        onCommit={(z) => patchSelected({ z })}
                      />
                    </div>
                    <div
                      className="spatial-nudge-grid"
                      aria-label="Переместить на 10 сантиметров"
                    >
                      <span />
                      <button
                        type="button"
                        aria-label="Переместить вверх на 10 см"
                        onClick={() =>
                          patchSelected({ z: rounded(selected.z - 0.1) })
                        }
                      >
                        <ChevronUp size={18} />
                      </button>
                      <span />
                      <button
                        type="button"
                        aria-label="Переместить влево на 10 см"
                        onClick={() =>
                          patchSelected({ x: rounded(selected.x - 0.1) })
                        }
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <span className="spatial-nudge-label">
                        <Move size={14} />
                      </span>
                      <button
                        type="button"
                        aria-label="Переместить вправо на 10 см"
                        onClick={() =>
                          patchSelected({ x: rounded(selected.x + 0.1) })
                        }
                      >
                        <ChevronRight size={18} />
                      </button>
                      <span />
                      <button
                        type="button"
                        aria-label="Переместить вниз на 10 см"
                        onClick={() =>
                          patchSelected({ z: rounded(selected.z + 0.1) })
                        }
                      >
                        <ChevronDown size={18} />
                      </button>
                      <span />
                    </div>
                  </div>
                  <div className="spatial-property-section">
                    <strong>Поворот</strong>
                    <div className="spatial-rotate-row">
                      <button
                        type="button"
                        aria-label="Повернуть влево на 15 градусов"
                        onClick={() =>
                          patchSelected({
                            rotation: normalizedRotation(
                              selected.rotation - 15,
                            ),
                          })
                        }
                      >
                        <RotateCcw size={16} />
                      </button>
                      <NumberField
                        key={`${selected.id}-angle`}
                        label="Угол"
                        value={selected.rotation}
                        suffix="°"
                        step={15}
                        onCommit={(rotation) =>
                          patchSelected({
                            rotation: normalizedRotation(rotation),
                          })
                        }
                      />
                      <button
                        type="button"
                        aria-label="Повернуть вправо на 15 градусов"
                        onClick={() =>
                          patchSelected({
                            rotation: normalizedRotation(
                              selected.rotation + 15,
                            ),
                          })
                        }
                      >
                        <RotateCw size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="spatial-property-section">
                    <strong>Размеры</strong>
                    {selectedMeta.resizable ? (
                      <>
                        <div className="spatial-field-row">
                          <NumberField
                            key={`${selected.id}-width`}
                            label="Ширина"
                            value={selected.width}
                            min={selectedMeta.minWidth}
                            max={selectedMeta.maxWidth}
                            onCommit={(width) => patchSelected({ width })}
                          />
                          <NumberField
                            key={`${selected.id}-depth`}
                            label="Глубина"
                            value={selected.depth}
                            min={selectedMeta.minDepth}
                            max={selectedMeta.maxDepth}
                            onCommit={(depth) => patchSelected({ depth })}
                          />
                        </div>
                        <p className="spatial-property-hint">
                          Ширина {selectedMeta.minWidth}–{selectedMeta.maxWidth}{" "}
                          м · глубина {selectedMeta.minDepth}–
                          {selectedMeta.maxDepth} м
                        </p>
                      </>
                    ) : (
                      <p className="spatial-property-hint">
                        {selected.width} × {selected.depth} м. Размеры реальной
                        мебели фиксированы.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="spatial-return"
                    onClick={removeSelected}
                  >
                    <Trash2 size={16} />
                    Вернуть на полку
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="spatial-properties-empty">
              <Move size={23} />
              <strong>Выберите предмет</strong>
              <p>
                {readOnly
                  ? "Нажмите на предмет, чтобы увидеть его размеры."
                  : "Нажмите на план или выберите предмет в списке. Положение и поворот можно менять без перетаскивания."}
              </p>
            </div>
          )}
          <div className="spatial-fixed-note">
            <strong>Основа зала</strong>
            <p>
              Стены и колонны закреплены. План, объём и прогулка показывают одну
              расстановку.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
