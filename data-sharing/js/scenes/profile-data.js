// Invented profile fields, shared by scene 2 and the fact-sheet label. All data is made up.
// src: camera = observed by a camera, inferred = guessed from patterns,
//      joined = taken from another record, estimate = an area average applied to one person.
export const SRC = {
  camera: "Seen by camera",
  inferred: "Inferred from pattern",
  joined: "Joined from a record",
  estimate: "Area estimate",
};
export const LAYERS = [
  {
    button: "Plate reads only",
    why: "A plate alone is just a string of characters, but six weeks of reads already say where this car lives and works.",
    fields: [
      ["Plate", "XYZ-0417 (invented)", "camera"],
      ["Vehicle", "Gray sedan", "camera"],
      ["Usual route", "Cam 1 → 2 → 3, weekdays", "camera"],
      ["Regular stops", "Gym Tue/Thu evenings; a place of worship on Sundays", "inferred"],
      ["Probable home area", "Near Cam 1", "inferred"],
    ],
  },
  {
    button: "Join a vehicle registry record",
    why: "A registry lists who a plate belongs to. Rules about who may look up that record exist (see the box below), but the join itself is one lookup.",
    fields: [
      ["Registered owner", "Alex Example", "joined"],
      ["Mailing address", "412 Sample St.", "joined"],
      ["Age", "34", "joined"],
      ["Sex on record", "F", "joined"],
      ["Vehicle record", "2018 sedan, registered since 2019", "joined"],
    ],
    pin: "home",
  },
  {
    button: "Match the address to the routine",
    why: "The registered address sits a few blocks from Cam 1, matching the overnight pattern. A guess has become a confirmed home.",
    fields: [["Home confirmed", "412 Sample St. is near Cam 1, where the car sleeps", "joined"]],
  },
  {
    button: "Add neighborhood statistics",
    why: "These are averages for a census area. Joined to a name, they read like facts about one person, and they can be wrong about that person. Race and ethnicity are not on a registry record: systems guess them, and guesses are often wrong.",
    fields: [
      ["Neighborhood", "Census block group 0034.02 (invented)", "estimate"],
      ["Typical household income", "$55–65k", "estimate"],
      ["Renters in the area", "62%", "estimate"],
      ["Typical household size", "2.4 people", "estimate"],
      ["Typical education", "Some college", "estimate"],
      ["Race / ethnicity (a guess)", "Likely non-Hispanic, 82% (guessed from surname and neighborhood; on no record)", "estimate"],
    ],
  },
  {
    button: "Guess the employer",
    why: "The car spends nine hours a day near Cam 3. A business directory turns that into an employer.",
    fields: [
      ["Likely workplace", "Example Corp., office park near Cam 3", "joined"],
      ["Work hours", "About 8:30 AM to 5:15 PM, Monday to Thursday", "inferred"],
    ],
    pin: "work",
  },
];

