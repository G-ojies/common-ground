/** The "Try an example" group: three friends in Lagos planning dinner. Real names, so it resolves against live Qloo data. */
export const EXAMPLE_GROUP = {
  outing: "dinner",
  city: "Lagos",
  vibe: "Affordable, somewhere we can talk after exams",
  people: [
    {
      name: "Ada",
      favourites: [
        { name: "Burna Boy", kind: "artist" },
        { name: "Things Fall Apart", kind: "book" },
        { name: "Terra Kulture", kind: "place" },
      ],
    },
    {
      name: "Tunde",
      favourites: [
        { name: "Wizkid", kind: "artist" },
        { name: "King of Boys", kind: "movie" },
        { name: "Yellow Chilli", kind: "place" },
      ],
    },
    {
      name: "Zainab",
      favourites: [
        { name: "Tems", kind: "artist" },
        { name: "Half of a Yellow Sun", kind: "book" },
        { name: "Nok by Alara", kind: "place" },
      ],
    },
  ],
} as const;
