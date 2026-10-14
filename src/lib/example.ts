/** The "Try an example" group: three friends in Lagos planning dinner. */
export const EXAMPLE_GROUP = {
  outing: "dinner",
  city: "Lagos",
  vibe: "Affordable, somewhere we can talk after exams",
  people: [
    {
      name: "Ada",
      favourites: [
        { name: "Burna Boy", kind: "artist" },
        { name: "Mock Jollof House", kind: "place" },
        { name: "Love on Allen Avenue", kind: "book" },
      ],
    },
    {
      name: "Tunde",
      favourites: [
        { name: "Spicy street suya", kind: "place" },
        { name: "Owambe Nights", kind: "movie" },
        { name: "Amapiano Collective", kind: "artist" },
      ],
    },
    {
      name: "Zainab",
      favourites: [
        { name: "Quiet Kitchen", kind: "movie" },
        { name: "Highlife Revival Band", kind: "artist" },
        { name: "Garden Cafe", kind: "place" },
      ],
    },
  ],
} as const;
