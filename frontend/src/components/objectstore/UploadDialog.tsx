import { useState, useRef } from 'react';
import { Upload, File } from 'lucide-react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { formatBytes } from '../../lib/format';

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucketName: string;
  onUpload: (name: string, file: globalThis.File) => Promise<void>;
}

export function UploadDialog({
  open,
  onOpenChange,
  bucketName,
  onUpload,
}: UploadDialogProps) {
  const [customName, setCustomName] = useState('');
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file && !customName) {
      setCustomName(file.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !customName.trim()) return;

    setUploading(true);
    try {
      await onUpload(customName.trim(), selectedFile);
      resetForm();
      onOpenChange(false);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setCustomName('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Object</DialogTitle>
          <DialogDescription>
            Upload a file to bucket &quot;{bucketName}&quot;
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="obj-file">File</Label>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <File className="h-5 w-5 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="font-medium">{selectedFile.name}</span>
                    <span className="text-muted-foreground ml-2">
                      ({formatBytes(selectedFile.size)})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Click to select a file
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              id="obj-file"
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="obj-name">Object Name</Label>
            <Input
              id="obj-name"
              placeholder="e.g., config/settings.json"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to the file name. You can use path-like names.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploading || !selectedFile || !customName.trim()}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
