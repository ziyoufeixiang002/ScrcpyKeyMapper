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
        const saveButton = document.getElementById('saveConfigBtn');
        const saveFilenameInput = document.getElementById('saveFilename');
        const loadButton = document.getElementById('loadConfig');

        // Load remembered filename from localStorage
        const rememberedName = localStorage.getItem('lastSavedFilename');
        if (rememberedName && saveFilenameInput) {
            saveFilenameInput.value = rememberedName;
        }

        if (saveButton) {
            saveButton.addEventListener('click', () => {
                this.saveToJson();
            });
        }

        // Save filename on input change and keypress
        if (saveFilenameInput) {
            // Save on change
            saveFilenameInput.addEventListener('change', () => {
                const filename = saveFilenameInput.value.trim();
                if (filename) {
                    localStorage.setItem('lastSavedFilename', filename);
                }
            });
            
            // Save on Enter key press
            saveFilenameInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const filename = saveFilenameInput.value.trim();
                    if (filename) {
                        localStorage.setItem('lastSavedFilename', filename);
                        this.saveToJson();
                    }
                }
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

            // Get filename from input field
            const saveFilenameInput = document.getElementById('saveFilename');
            let filename = saveFilenameInput?.value.trim() || 'key-mapping-config.json';

            // Ensure .json extension
            if (!filename.toLowerCase().endsWith('.json')) {
                filename += '.json';
            }

            // Save using traditional download method (no popup)
            this.saveWithDownload(config, filename);
        } catch (error) {
            console.error('Error saving configuration:', error);
        }
    }

    saveWithDownload(config, filename) {
        // Create a Blob containing the JSON data
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Create a temporary link element to trigger the download
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();

        // Clean up
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Remember the filename for next time
        localStorage.setItem('lastSavedFilename', filename);
        
        console.log('文件已保存:', filename);
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
