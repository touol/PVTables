export const rowsHandler = (rowsData, fields) => {
  let rows = [];

  if (rowsData.length) {
    rowsData.forEach(function (item) {
      for (let field in fields) {
        // if (field == "id") item[field] = Number(item[field]);
        switch (fields[field].type) {
          case "boolean":
            if (item.hasOwnProperty(field)) {
              if (item[field] == null || item[field] === "0") {
                item[field] = false;
              } else {
                item[field] = true;
              }
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