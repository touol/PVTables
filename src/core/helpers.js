export const rowsHandler = (rowsData, fields) => {
  let rows = [];

  if (rowsData.length) {
    rowsData.forEach(function (item) {
      for (let field in fields) {
        // if (field == "id") item[field] = Number(item[field]);
        switch (fields[field].type) {
          case "boolean":
            if (item.hasOwnProperty(field)) {
              // Ложь — и строка "0", и число 0: на PHP 8.1+ PDO MySQL отдаёт целые числами,
              // и 0 раньше становился true (08.10.2026, галочки «включён» у выключенных тарифов)
              const v = item[field];
              item[field] = !(v == null || v === "" || v === false || v == 0);
            }
            break;
          // case "number":
          // case "decimal":
          //   item[field] = Number(item[field]);
          //   break;
        }
      }
      rows.push(item);
    })
  }

  return rows
}