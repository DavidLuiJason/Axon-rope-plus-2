/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Video Editor: full-screen editor placeholder for media tools.
 */

import React from 'react';
import { ScreenHeader } from '../ScreenHeader';

interface VideoEditorScreenProps {
  onBack: () => void;
  onLogoClick?: () => void;
}

export const VideoEditorScreen: React.FC<VideoEditorScreenProps> = ({
  onBack,
  onLogoClick,
}) => {
  return (
    <div className="relative w-full h-full flex flex-col bg-[#121315] text-[#ECECEC] overflow-hidden select-none font-sans">
      <ScreenHeader
        title="Video Editor"
        tagline="VIDEO EDITOR"
        backLabel="MEDIA"
        collapsible
        onBack={onBack}
        onLogoClick={onLogoClick ?? (() => {})}
      />

      <div className="flex-1 flex items-center justify-center px-6 text-center">
        <p className="text-sm font-sans text-[#8E9094]">
          Video editor is coming soon.
        </p>
      </div>
    </div>
  );
};

export default VideoEditorScreen;
