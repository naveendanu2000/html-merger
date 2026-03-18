import axios from "axios";
import { useEffect, useState } from "react";

interface Data {
  diffResult: {
    type: string;
    word: string;
    oldIndex?: number;
    newIndex?: number;
    created_by?: string;
  }[];
  changes: {
    type: string;
    word: string;
    oldIndex?: number;
    newIndex?: number;
    description: string;
  }[];
}
function Update() {
  const [data, setData] = useState<Data>();

  useEffect(() => {
    const updateData = async () => {
      try {
        const response = await axios.get(
          "http://localhost:3000/api/update/1/6",
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
    <div className="flex flex-col items-center justify-center p-10 max-w-200 shadow">
      <div
        className="mb-10"
        dangerouslySetInnerHTML={{
          __html:
            data?.diffResult
              .map((wordObject) => {
                const isTag = wordObject.word.startsWith("<");
                if (isTag) return wordObject.word;

                const colorClass =
                  wordObject.type === "added"
                    ? "text-green-500"
                    : wordObject.type === "deleted"
                      ? "text-red-500"
                      : "";

                const change = data.changes.find(
                  (c) =>
                    c.word === wordObject.word &&
                    c.type === wordObject.type &&
                    c.newIndex === wordObject.newIndex,
                );

                if (colorClass && change) {
                  return `
                <span class="relative inline-block group">
                  <span class="${colorClass} cursor-pointer">${wordObject.word} </span>
                  <span class="
                    absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                    hidden group-hover:block
                    bg-gray-900 text-white text-xs rounded px-2 py-1
                    whitespace-nowrap shadow-lg pointer-events-none
                  ">
                    ${change.description}
                  </span>
                </span>
              `;
                } else {
                  return `
                <span class="relative inline-block group">
                  <span class="${colorClass} cursor-pointer">${wordObject.word} </span>
                  <span class="
                    absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                    hidden group-hover:block
                    bg-gray-900 text-white text-xs rounded px-2 py-1
                    whitespace-nowrap shadow-lg pointer-events-none
                  ">
                    Created by: ${wordObject.created_by}
                  </span>
                </span>
              `;
                }

                // return colorClass
                //   ? `<span class="${colorClass}">${wordObject.word} </span>`
                //   : wordObject.word + " ";
              })
              .join("") ?? "",
        }}
      />
    </div>
  );
}

export default Update;
