import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod"

import { Loader2, MoveLeft } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { sendYoutubeLink } from "@/api/notes";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import { fetchSingleNote } from "@/store/chatSlice";
import { fetchNoteSourceResult } from "@/store/rightPanelSlice";
import { showError, showSuccess } from "@/util/toast-notification";

const formSchema = z.object({
    youtubeLink: z
        .string()
        .min(1, "Link is required")
        .url("Please enter a valid URL"),
});

type FormValues = z.infer<typeof formSchema>;

const AddYoutubeLinkForm = ({ hideYoutubeLinkForm, noteId }: { hideYoutubeLinkForm: () => void, noteId?: string }) => {
    const dispatch = useDispatch<AppDispatch>();
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
    });

    const onSubmit = async (data: FormValues) => {
        if (!noteId) {
            showError("Open a notebook before adding a YouTube link");
            return;
        }

        try {
            await sendYoutubeLink(data.youtubeLink, noteId);
            await dispatch(fetchSingleNote(noteId));
            dispatch(fetchNoteSourceResult(noteId));
            showSuccess("YouTube source added");
            reset();
            hideYoutubeLinkForm();
        } catch {
            showError("Failed to add YouTube link");
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="p-1 mb-4 mt-4 space-y-3">
            <div className="flex items-center gap-2">
                <button type="button" onClick={hideYoutubeLinkForm} className="cursor-pointer">
                    <MoveLeft />
                </button>
                <Label htmlFor="link" className="text-sm font-semibold">
                    Paste a youtube link
                </Label>
            </div>

            <Textarea
                id="link"
                placeholder="https://www.youtube.com/watch?v=..."
                className="resize-y min-h-[100px] mt-2 text-sm placeholder:text-sm"
                {...register("youtubeLink")}
            />

            {errors.youtubeLink && (
                <p className="text-red-500 text-xs mt-1">{errors.youtubeLink.message}</p>
            )}

            <div className="flex">
                <div></div>
                <div></div>
                <div className="ml-auto">
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            "Submit"
                        )}
                    </Button>
                </div>
            </div>

        </form>
    );
};

export default AddYoutubeLinkForm;
