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
    <div className="flex flex-col items-center justify-center p-10 max-w-200 shadow">
      <div
        className="mb-10"
        dangerouslySetInnerHTML={{
          __html:
            data?.map((wordObject) => {
                const isTag = wordObject.word.startsWith("<");
                if (isTag) return wordObject.word;

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

                return `
              <span class="relative inline-block group">
                <span class="${colorClass} cursor-pointer">${wordObject.word} </span>
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
              </span>
            `;
              })
              .join("") ?? "",
        }}
      />
    </div>
  );
}

export default App;
