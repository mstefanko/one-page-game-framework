import React from "react";
import { createRoot } from "react-dom/client";
import { Composer } from "@onepage/music-editor";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Composer />
  </React.StrictMode>,
);
