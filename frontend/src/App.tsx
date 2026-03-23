import { useEffect, useState } from "react";
import "./App.css";
import axios from "axios";

interface Data {
  update_type: string;
  word: string;
  oldIndex?: number;
  newIndex?: number;
  created_by?: string;
  deleted_by?: string;
}

const image = (wordObject: Data): string => {
  return `
          <div
            style="padding: 10px;display: inline-block;cursor:  pointer;background-color: ${
              wordObject.update_type === "deleted"
                ? "#FF8975"
                : wordObject.update_type === "added"
                  ? "#ABFF9E"
                  : ""
            }"
          >
            ${wordObject.word}
          </div>
          `;
};

function App() {
  const [data, setData] = useState<Data[]>();

  useEffect(() => {
    const updateData = async () => {
      try {
        const response = await axios.get(
          "http://localhost:3000/api/changes/1/1",
        );
        console.log(response.data);
        if (response) setData(response.data);
      } catch (error) {
        console.log(error);
      }
    };

    updateData();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-10 max-w-200 shadow mb-10 [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:my-1">
      <div
        className="mb-10"
        dangerouslySetInnerHTML={{
          __html:
            data
              ?.map((wordObject) => {
                const word = wordObject.word;
                const isImageTag = word.startsWith("<img");

                // Match merged formatting tokens like <b>banana</b>, <strong>text</strong>
                const mergedFormatMatch = word.match(
                  /^(<(b|i|u|strong|em|mark|s|span|del|ins|a)(?:\s[^>]*)?>)(.*?)(<\/\2>)$/i,
                );

                // Plain structural tags like <div>, </div>, <p>, <br/> — render as-is
                const isStructuralTag =
                  word.startsWith("<") && !isImageTag && !mergedFormatMatch;

                if (isStructuralTag) return word;

                // Build color class and tooltip
                let colorClass = "";
                let tooltipText = "";

                if (wordObject.update_type === "added") {
                  colorClass = "text-green-500";
                  tooltipText = `Added By: ${wordObject.created_by}`;
                } else if (wordObject.update_type === "deleted") {
                  colorClass = "text-red-500 line-through";
                  tooltipText = `Created By: ${wordObject.created_by}<br/>Deleted By: ${wordObject.deleted_by}`;
                } else {
                  tooltipText = `Created By: ${wordObject.created_by}`;
                }

                // For merged formatting tokens, wrap the inner word with the formatting tag
                // e.g. <b>banana</b> => <b><span class="text-red-500">banana</span></b>
                let displayContent: string;
                if (mergedFormatMatch) {
                  const [, openTag, , innerWord, closeTag] = mergedFormatMatch;
                  displayContent = `${openTag}<span class="${colorClass}">${innerWord}</span>${closeTag}`;
                } else if (isImageTag) {
                  displayContent = image(wordObject);
                } else {
                  displayContent = word;
                }

                return `
              <div class="relative inline-block group">
                <div class="${mergedFormatMatch ? "" : colorClass} inline-block cursor-pointer">${displayContent} </div>
                <span
                  class="
                    absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                    hidden group-hover:block
                    bg-gray-900 text-white text-xs rounded px-2 py-1
                    whitespace-nowrap shadow-lg pointer-events-none
                  "
                >
                  ${tooltipText}
                </span>
              </div>
            `;
              })
              .join("") ?? "",
        }}
      />
    </div>
  );
}

export default App;
