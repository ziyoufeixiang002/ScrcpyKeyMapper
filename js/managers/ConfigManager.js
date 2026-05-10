import { DEFAULT_CONFIG, MAPPING_TYPES } from '../utils/constants.js';
import { KeyDisplayManager } from './KeyDisplayManager.js';

export class ConfigManager {
    constructor(nodeManager) {
        this.nodeManager = nodeManager;
        this._switchKey = DEFAULT_CONFIG.SWITCH_KEY;
        this.setupConfigButtons();
    }

    get switchKey() {
        return this._switchKey;
    }

    set switchKey(value) {
        this._switchKey = value;
        // Update input value
        const switchKeyInput = document.getElementById('switchKeyGlobal');
        if (switchKeyInput) {
            switchKeyInput.value = KeyDisplayManager.formatKeyText(value);
        }
    }

    setupConfigButtons() {
        const saveButton = document.getElementById('saveConfig');
        const loadButton = document.getElementById('loadConfig');

        if (saveButton) {
            saveButton.addEventListener('click', () => {
                this.saveToJson();
            });
        }

        if (loadButton) {
            loadButton.addEventListener('change', (event) => {
                if (event.target.files.length > 0) {
                    this.loadFromJson(event.target.files[0]);
                    // Reset the file input value so the same file can be selected again
                    event.target.value = '';
                }
            });
        }
    }

    saveToJson() {
        try {
            const allMappings = this.nodeManager.getMappingsData();
            const mouseMove = allMappings.find(m => m.type === MAPPING_TYPES.MOUSE_MOVE);
            const otherMappings = allMappings.filter(m => m.type !== MAPPING_TYPES.MOUSE_MOVE);

            // Clean up smallEyes data if disabled
            if (mouseMove && (!mouseMove.smallEyes || !mouseMove.smallEyes.enabled)) {
                delete mouseMove.smallEyes;
            }

            const background = this.nodeManager.stage.findOne('.background');
            const config = {
                switchKey: this.switchKey,
                mouseMoveMap: mouseMove,
                keyMapNodes: otherMappings,
                width: background?.getAttr('originalWidth') || this.nodeManager.stage.width(),
                height: background?.getAttr('originalHeight') || this.nodeManager.stage.height()
            };

            // Get last used filename from localStorage
            let lastFileName = localStorage.getItem('lastSavedFileName') || 'key-mapping-config.json';
            
            // Create a Blob containing the JSON data
            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });

            // Try to use File System Access API if available (Chrome/Edge)
            if (window.showSaveFilePicker) {
                this.saveWithFileSystemAccess(blob, lastFileName);
            } else {
                // Fallback to traditional download method
                this.saveWithDownload(blob, lastFileName);
            }
        } catch (error) {
            console.error('Error saving configuration:', error);
        }
    }

    async saveWithFileSystemAccess(blob, defaultName) {
        try {
            // Extract directory and filename from last used path
            let suggestedName = defaultName;
            
            const handle = await window.showSaveFilePicker({
                suggestedName: suggestedName,
                types: [{
                    description: 'JSON Files',
                    accept: { 'application/json': ['.json'] }
                }]
            });

            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();

            // Save the file name for next time (we can't save full path due to security)
            const fileName = handle.name;
            localStorage.setItem('lastSavedFileName', fileName);
            
            // Also save the directory handle reference if possible
            localStorage.setItem('lastSavedFileName', fileName);
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error with File System Access API:', error);
                // Fallback to traditional download
                this.saveWithDownload(blob, defaultName);
            }
        }
    }

    saveWithDownload(blob, defaultName) {
        // Prompt user for filename
        const fileName = prompt('Enter filename to save:', defaultName);
        
        if (fileName === null) {
            // User cancelled
            return;
        }
        
        const finalFileName = fileName.trim() || defaultName;
        const finalFileNameWithExt = finalFileName.endsWith('.json') ? finalFileName : finalFileName + '.json';

        // Create a temporary link element to trigger the download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFileNameWithExt;
        document.body.appendChild(link);
        link.click();

        // Clean up
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Save the filename for next time
        localStorage.setItem('lastSavedFileName', finalFileNameWithExt);
    }

    loadFromJson(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target.result);
                
                // Clear existing mappings
                this.nodeManager.clearAllNodes();

                // Set switch key
                if (config.switchKey) {
                    this.switchKey = config.switchKey;
                }

                // Load mouseMoveMap if present
                if (config.mouseMoveMap) {
                    const source = {
                        type: MAPPING_TYPES.MOUSE_MOVE,
                        ...config.mouseMoveMap
                    };
                    this.nodeManager.createNode(source);
                }

                // Load keyMapNodes
                if (config.keyMapNodes) {
                    config.keyMapNodes.forEach(source => {
                        this.nodeManager.createNode(source);
                    });
                }

                // Apply current scale to all nodes
                const currentScale = parseFloat(document.getElementById('nodeScale').value) || 1.0;
                this.nodeManager.nodes.forEach(node => {
                    node.setScale(currentScale);
                });

                // Redraw the layer
                this.nodeManager.layer.batchDraw();
            } catch (error) {
                console.error('Error loading configuration:', error);
            }
        };
        reader.readAsText(file);
    }
}
