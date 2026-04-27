// ── Altitude Formatted ───────────────────────────────────────────────────
const reformatdate = (altitude, altdesc, byATC) => {
  const splitLimit = 5;
  let formatedAltitude = "";
  if (altdesc !== "") {
    if (altitude.length > 5 && altdesc !== "V") {
      const [upLimit, lowLimit] = [
        altitude.substr(0, splitLimit),
        altitude.substr(splitLimit),
      ];

      formatedAltitude = `${checkIfLevel(upLimit)} (${altdesc}) ${checkIfLevel(
        lowLimit,
      )}`;
    } else {
      formatedAltitude = `(${altdesc == "" ? "@" : altdesc}) ${
        altitude.includes("F") ? altitude : Number(altitude)
      }`;
    }
  } else {
    let single = checkIfLevel(altitude);
    single =
      single !== 0
        ? !single.toString().includes("(")
          ? `(@) ${single}`
          : single
        : "";
    formatedAltitude = single;
  }
  if (byATC == "A") {
    formatedAltitude = `${formatedAltitude}\n(BY ATC)`;
  }
  return formatedAltitude;
};
const checkIfLevel = (altitude) => {
  return altitude.includes("F") ? altitude : Number(altitude);
};

// ── Distance and Course Formatted ───────────────────────────────────────────────────
const formatdecimals = (inp) => {
  const val = inp.replace(/x/g, "");
  if (val !== "") {
    const isTime = val.includes("T") ? "T" : "";

    let crs = val.replace("T", "").replace("D", "").replace("P", "");
    const decimal = crs.substr(crs.length - 1);
    crs = Number(
      crs.substr(0, crs.length - 1) + `${decimal !== "" ? "." + decimal : ""}`,
    );

    let finalOut = !isNaN(crs) && crs !== 0 ? crs + isTime : "";
    finalOut = finalOut.includes("T")
      ? finalOut.replace("T", " min")
      : finalOut;
    return finalOut;
  } else {
    return "";
  }
};
const gradientCleanup = (val) => {
  // gradient:
  if (val !== "") {
    val = `${val.substr(0, 1)} ${Number(val.substr(1)) / 100}°`;
  }
  return val;
};
module.exports = { reformatdate, formatdecimals, gradientCleanup };
