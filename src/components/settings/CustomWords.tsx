import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSettings } from "../../hooks/useSettings";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { SettingContainer } from "../ui/SettingContainer";

interface CustomWordsProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const CustomWords: React.FC<CustomWordsProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();
    const [newWord, setNewWord] = useState("");
    const [batchText, setBatchText] = useState("");
    const customWords = getSetting("custom_words") || [];

    const handleAddWord = () => {
      const trimmedWord = newWord.trim();
      const sanitizedWord = trimmedWord.replace(/[<>"'&]/g, "");
      if (
        sanitizedWord &&
        !sanitizedWord.includes(" ") &&
        sanitizedWord.length <= 50
      ) {
        if (customWords.includes(sanitizedWord)) {
          toast.error(
            t("settings.advanced.customWords.duplicate", {
              word: sanitizedWord,
            }),
          );
          return;
        }
        updateSetting("custom_words", [...customWords, sanitizedWord]);
        setNewWord("");
      }
    };

    const handleBatchAdd = () => {
      const lines = batchText
        .split("\n")
        .map((line: string) => line.trim().replace(/[<>"'&]/g, ""))
        .filter((line: string) => line.length > 0 && line.length <= 50);

      if (lines.length === 0) {
        toast.error(t("settings.advanced.customWords.batchEmpty"));
        return;
      }

      const existingSet = new Set(customWords);
      const newWords: string[] = [];
      let skipped = 0;

      for (const word of lines) {
        if (existingSet.has(word)) {
          skipped++;
        } else {
          newWords.push(word);
          existingSet.add(word);
        }
      }

      if (newWords.length > 0) {
        updateSetting("custom_words", [...customWords, ...newWords]);
        setBatchText("");
        toast.success(
          t("settings.advanced.customWords.batchAdded", {
            count: newWords.length,
          }),
        );
      }
      if (skipped > 0) {
        toast.info(
          t("settings.advanced.customWords.batchSkipped", {
            count: skipped,
          }),
        );
      }
    };

    const handleRemoveWord = (wordToRemove: string) => {
      updateSetting(
        "custom_words",
        customWords.filter((word) => word !== wordToRemove),
      );
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddWord();
      }
    };

    return (
      <>
        <SettingContainer
          title={t("settings.advanced.customWords.title")}
          description={t("settings.advanced.customWords.description")}
          descriptionMode={descriptionMode}
          grouped={grouped}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                className="max-w-40"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={t("settings.advanced.customWords.placeholder")}
                variant="compact"
                disabled={isUpdating("custom_words")}
              />
              <Button
                onClick={handleAddWord}
                disabled={
                  !newWord.trim() ||
                  newWord.includes(" ") ||
                  newWord.trim().length > 50 ||
                  isUpdating("custom_words")
                }
                variant="primary"
                size="md"
              >
                {t("settings.advanced.customWords.add")}
              </Button>
            </div>
            <div className="flex gap-2">
              <textarea
                className="flex-1 min-h-[80px] max-h-[200px] p-2 text-sm rounded-md border border-mid-gray/30 bg-transparent resize-y focus:outline-none focus:border-accent"
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={t(
                  "settings.advanced.customWords.batchPlaceholder",
                )}
                disabled={isUpdating("custom_words")}
              />
              <Button
                onClick={handleBatchAdd}
                disabled={!batchText.trim() || isUpdating("custom_words")}
                variant="secondary"
                size="md"
                className="self-end"
              >
                {t("settings.advanced.customWords.batchAdd")}
              </Button>
            </div>
          </div>
        </SettingContainer>
        {customWords.length > 0 && (
          <div
            className={`px-4 p-2 ${grouped ? "" : "rounded-lg border border-mid-gray/20"} flex flex-wrap gap-1`}
          >
            {customWords.map((word) => (
              <Button
                key={word}
                onClick={() => handleRemoveWord(word)}
                disabled={isUpdating("custom_words")}
                variant="secondary"
                size="sm"
                className="inline-flex items-center gap-1 cursor-pointer"
                aria-label={t("settings.advanced.customWords.remove", { word })}
              >
                <span>{word}</span>
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            ))}
          </div>
        )}
      </>
    );
  },
);
