export const hall = Object.freeze({
  name: "Учебный зал",
  width: 16,
  depth: 12,
  height: 3.6,
  columns: [
    { id: "column-1", x: 5.5, z: 6.75, width: 0.65, depth: 0.65, rotation: 0 },
    { id: "column-2", x: 10.5, z: 6.75, width: 0.65, depth: 0.65, rotation: 0 },
  ],
  entrance: { x: 8, z: 11.35 },
  entranceZone: { x: 8, z: 11.5, width: 2.2, depth: 1, rotation: 0 },
});
export const HALL = hall;
export const hall16x12 = hall;

export const furniture = Object.freeze({
  roundTable: {
    label: "Круглый стол",
    description: "Комплект на 8 мест",
    seats: 8,
    width: 2.2,
    depth: 2.2,
    color: "#e5e7eb",
    shape: "circle",
  },
  banquetTable: {
    label: "Банкетный стол",
    description: "Комплект на 6 мест",
    seats: 6,
    width: 2.8,
    depth: 1.8,
    color: "#e5e7eb",
  },
  chair: {
    label: "Стул",
    description: "1 место",
    seats: 1,
    width: 0.5,
    depth: 0.55,
    color: "#b8c4d6",
  },
  stage: {
    label: "Сцена",
    description: "Размеры можно менять",
    seats: 0,
    width: 4,
    depth: 2.2,
    color: "#c7d2fe",
    resizable: true,
    minWidth: 2,
    maxWidth: 8,
    minDepth: 1.5,
    maxDepth: 5,
  },
  dancefloor: {
    label: "Танцпол",
    description: "Свободная зона",
    seats: 0,
    width: 3,
    depth: 3,
    color: "#fef3c7",
    resizable: true,
    minWidth: 2,
    maxWidth: 8,
    minDepth: 2,
    maxDepth: 8,
  },
});

export function createDefaultScene() {
  const items = [];
  for (const z of [5, 8.5])
    for (const x of [2, 5, 8, 11, 14]) {
      items.push({
        id: `table-${items.length + 1}`,
        type: "roundTable",
        x,
        z,
        rotation: 0,
        width: 2.2,
        depth: 2.2,
      });
    }
  items.push({
    id: "stage-1",
    type: "stage",
    x: 8,
    z: 1.5,
    rotation: 0,
    width: 4,
    depth: 2.2,
  });
  return { items };
}

export function seatCount(scene) {
  return (scene?.items || []).reduce(
    (sum, item) => sum + (furniture[item.type]?.seats || 0),
    0,
  );
}

export function normalizedRotation(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function corners(item) {
  const angle = ((item.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, z]) => ({
    x: item.x + ((x * item.width) / 2) * cos - ((z * item.depth) / 2) * sin,
    z: item.z + ((x * item.width) / 2) * sin + ((z * item.depth) / 2) * cos,
  }));
}

function circleRect(circle, rectangle, padding = 0) {
  const angle = (-(rectangle.rotation || 0) * Math.PI) / 180;
  const dx = circle.x - rectangle.x,
    dz = circle.z - rectangle.z;
  const x = dx * Math.cos(angle) - dz * Math.sin(angle);
  const z = dx * Math.sin(angle) + dz * Math.cos(angle);
  const nearestX = Math.max(
    -rectangle.width / 2,
    Math.min(rectangle.width / 2, x),
  );
  const nearestZ = Math.max(
    -rectangle.depth / 2,
    Math.min(rectangle.depth / 2, z),
  );
  return (
    Math.hypot(x - nearestX, z - nearestZ) <
    circle.width / 2 + padding - 0.00001
  );
}

function overlaps(a, b, padding = 0.08) {
  const circleA = furniture[a.type]?.shape === "circle";
  const circleB = furniture[b.type]?.shape === "circle";
  if (circleA && circleB)
    return (
      Math.hypot(a.x - b.x, a.z - b.z) <
      (a.width + b.width) / 2 + padding - 0.00001
    );
  if (circleA) return circleRect(a, b, padding);
  if (circleB) return circleRect(b, a, padding);
  const p = corners(a),
    q = corners(b);
  for (const polygon of [p, q]) {
    for (let index = 0; index < 4; index++) {
      const first = polygon[index],
        second = polygon[(index + 1) % 4];
      let axisX = -(second.z - first.z),
        axisZ = second.x - first.x;
      const length = Math.hypot(axisX, axisZ);
      axisX /= length;
      axisZ /= length;
      const aa = p.map((point) => point.x * axisX + point.z * axisZ);
      const bb = q.map((point) => point.x * axisX + point.z * axisZ);
      if (
        Math.max(...aa) + padding <= Math.min(...bb) ||
        Math.max(...bb) + padding <= Math.min(...aa)
      )
        return false;
    }
  }
  return true;
}

// Returns { valid: boolean, message: string }. Coordinates and dimensions are metres.
export function validatePlacement(item, scene, ignoreId = item?.id) {
  const meta = Object.hasOwn(furniture, item?.type)
    ? furniture[item.type]
    : null;
  if (!meta) return { valid: false, message: "Неизвестный предмет" };
  if (
    !["x", "z", "width", "depth", "rotation"].every((key) =>
      Number.isFinite(item[key]),
    )
  )
    return { valid: false, message: "Введите корректные числа" };
  if (meta.resizable) {
    if (
      item.width < meta.minWidth ||
      item.width > meta.maxWidth ||
      item.depth < meta.minDepth ||
      item.depth > meta.maxDepth
    ) {
      return {
        valid: false,
        message: `Допустимо: ширина ${meta.minWidth}–${meta.maxWidth} м, глубина ${meta.minDepth}–${meta.maxDepth} м`,
      };
    }
  } else if (
    Math.abs(item.width - meta.width) > 0.001 ||
    Math.abs(item.depth - meta.depth) > 0.001
  ) {
    return { valid: false, message: "У реальной мебели фиксированные размеры" };
  }
  const points =
    meta.shape === "circle"
      ? [
          { x: item.x - item.width / 2, z: item.z - item.depth / 2 },
          { x: item.x + item.width / 2, z: item.z + item.depth / 2 },
        ]
      : corners(item);
  if (
    points.some(
      (point) =>
        point.x < 0.12 ||
        point.x > hall.width - 0.12 ||
        point.z < 0.12 ||
        point.z > hall.depth - 0.12,
    )
  )
    return { valid: false, message: "Предмет выходит за границы зала" };
  if (hall.columns.some((column) => overlaps(item, column)))
    return { valid: false, message: "Пересечение с неподвижной колонной" };
  if (overlaps(item, hall.entranceZone))
    return { valid: false, message: "Оставьте вход свободным" };
  const other = (scene?.items || []).find(
    (candidate) => candidate.id !== ignoreId && overlaps(item, candidate),
  );
  if (other)
    return {
      valid: false,
      message: `Пересечение: ${furniture[other.type]?.label || "другой предмет"}`,
    };
  return { valid: true, message: "" };
}

export function findPlacement(type, scene) {
  const meta = furniture[type];
  if (!meta) return null;
  for (let z = 1.5; z <= hall.depth - 0.5; z += 0.5) {
    for (let x = 1; x <= hall.width - 0.5; x += 0.5) {
      const item = {
        id: `item-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
        type,
        x,
        z,
        width: meta.width,
        depth: meta.depth,
        rotation: 0,
      };
      if (validatePlacement(item, scene).valid) return item;
    }
  }
  return null;
}

export function isWalkable(x, z, scene, radius = 0.24) {
  if (
    x < radius ||
    x > hall.width - radius ||
    z < radius ||
    z > hall.depth - radius
  )
    return false;
  const person = {
    type: "roundTable",
    x,
    z,
    width: radius * 2,
    depth: radius * 2,
    rotation: 0,
  };
  return ![
    ...hall.columns,
    ...(scene?.items || []).filter((item) => item.type !== "dancefloor"),
  ].some((item) => overlaps(person, item, 0.015));
}
