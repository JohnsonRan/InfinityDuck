// SPDX-License-Identifier: Apache-2.0

'use strict';
'require dom';
'require fs';
'require poll';
'require view';
'require ui';

return view.extend({
	render: function() {
		/* Thanks to luci-app-aria2 */
		var css = '					\
			#log_textarea {				\
				text-align: left;			\
				max-height: 70vh;		\
				overflow-y: auto;			\
				color-scheme: light dark;	\
				background-color: #f8f9fa;	\
				border-radius: 8px;		\
				border: 1px solid #ddd;		\
				font-size: 13px;		\
				box-shadow: 0 2px 5px rgba(0,0,0,0.05); \
			}					\
			#log_textarea pre {			\
				padding: .7rem;			\
				word-break: break-all;		\
				margin: 0;				\
				font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;	\
				line-height: 1.4;		\
			}					\
			.log-info { color: #0366d6; }		\
			.log-warn { color: #f59f00; }		\
			.log-error { color: #d73a49; font-weight: bold; } \
			.log-debug { color: #6f42c1; }		\
			.log-ip { color: #22863a; font-weight: bold; }		\
			.description {				\
				background-color: #33ccff;	\
				}					\
			.log-container {            \
				padding: 2px 0;        \
			}                          \
			.log-container:hover {     \
				background-color: rgba(0,0,0,0.03); \
			}                          \
			.controls-container {      \
				margin-bottom: 15px;   \
				display: flex;         \
				flex-wrap: wrap;       \
				gap: 10px;             \
			}                          \
			.controls-row {            \
				display: flex;         \
				gap: 10px;             \
				flex-wrap: wrap;       \
				margin-bottom: 10px;   \
			}                          \
			.controls-row:last-child { \
				margin-bottom: 0;      \
			}                          \
			#filterInput {             \
				max-width: 200px;      \
				flex: 1;               \
				min-width: 120px;      \
				padding: 5px;          \
				border-radius: 4px;    \
				border: 1px solid #ddd; \
			}                          \
			.filter-highlight {        \
				background-color: #ffeb3b; \
				color: black;          \
				padding: 0 2px;        \
				border-radius: 3px;    \
				font-weight: bold;     \
			}                          \
			#log_textarea::-webkit-scrollbar {	\
				width: 10px;			\
			}					\
			#log_textarea::-webkit-scrollbar-track {\
				background: rgba(0, 0, 0, 0.03);	\
				border-radius: 4px;      \
			}					\
			#log_textarea::-webkit-scrollbar-thumb {\
				background: rgba(0, 0, 0, 0.15);	\
				border-radius: 4px;		\
				border: 2px solid #f8f9fa; \
			}					\
			#log_textarea::-webkit-scrollbar-thumb:hover {\
				background: rgba(0, 0, 0, 0.25);	\
			}					\
			@media (prefers-color-scheme: dark) {	\
				#log_textarea {			\
					background-color: #252a30;	\
					border-color: #444;		\
					color: #e6e6e6;       \
				}				\
				.log-container:hover {     \
					background-color: rgba(255,255,255,0.05); \
				}                          \
				.filter-highlight {        \
					background-color: #b58b00; \
					color: #ffffff;       \
				}                          \
				.log-info { color: #58a6ff; }  \
				.log-warn { color: #ffab70; }  \
				.log-error { color: #f97583; } \
				.log-debug { color: #d2a8ff; } \
				.log-ip { color: #7ee787; }    \
				#log_textarea::-webkit-scrollbar-track {\
					background: rgba(255, 255, 255, 0.03);\
				}				\
				#log_textarea::-webkit-scrollbar-thumb {\
					background: rgba(255, 255, 255, 0.15);\
					border: 2px solid #252a30; \
				}				\
				#log_textarea::-webkit-scrollbar-thumb:hover {\
					background: rgba(255, 255, 255, 0.25);\
				}							\
				#filterInput {          \
					background-color: #252a30; \
					border-color: #444; \
					color: #e6e6e6;     \
				}                       \
			}                          \
			@media (min-width: 768px) { \
				.controls-container {  \
					flex-direction: row; \
					flex-wrap: nowrap;  \
				}                      \
				.controls-row {        \
					margin-bottom: 0;   \
					flex: 1;           \
				}                      \
				.controls-row:first-child { \
					flex: 2;           \
				}                      \
			}';

		var log_textarea = E('div', { 'id': 'log_textarea' },
			E('img', {
				'src': L.resource('icons/loading.gif'),
				'alt': _('Loading...'),
				'style': 'vertical-align:middle'
			}, _('Collecting data…'))
		);
		
		function formatLogLine(line) {
			line = line.replace(/</g, '&lt;').replace(/>/g, '&gt;');
			
			line = line
				.replace(/\b(error|failed)\b/g, '<span class="log-error">$1</span>')
				.replace(/\b(warn|warning)\b/g, '<span class="log-warn">$1</span>')
				.replace(/\b(info|INFO)\b/g, '<span class="log-info">$1</span>')
				.replace(/\b(debug|DEBUG)\b/g, '<span class="log-debug">$1</span>')
				.replace(/\blevel=(error|warn|info|debug)\b/g, 'level=<span class="log-$1">$1</span>');

			line = line.replace(/(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/g,
				'<span class="log-ip">$1</span>');
				
			return '<div class="log-container">' + line + '</div>';
		}

		var originalLogContent = '';
		var logEntriesCache = null;
		var debounceTimeout = null;

		function debounce(func, wait) {
			return function(...args) {
				const context = this;
				clearTimeout(debounceTimeout);
				debounceTimeout = setTimeout(() => {
					func.apply(context, args);
				}, wait);
			};
		}

		function highlightFilter(text, filter) {
			if (!filter) return text;
			
			var safeFilter = filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			var regex = new RegExp('(' + safeFilter + ')', 'gi');
			
			return text.replace(regex, '<span class="filter-highlight">$1</span>');
		}

		poll.add(L.bind(function() {
			return fs.read_direct('/var/log/duck/duck.log', 'text')
			.then(function(content) {
				var contentLines = content.trim().split(/\r?\n/);
				var reversedContent = contentLines.reverse();
				
				var formattedLines = reversedContent.map(function(line) {
					return formatLogLine(line);
				});
				
				var formattedContent = formattedLines.join('');
				originalLogContent = formattedContent;
				logEntriesCache = null;
				
				var logContainer = E('pre', {});
				logContainer.innerHTML = formattedContent || _('Log is empty.');
				
				dom.content(log_textarea, logContainer);

				var filterInput = document.getElementById('filterInput');
				if (filterInput && filterInput.value) {
					applyFilter(filterInput.value);
				}
			}).catch(function(e) {
				var log;

				if (e.toString().includes('NotFoundError'))
					log = E('pre', { 'wrap': 'pre' }, [
						_('Log file does not exist.')
					]);
				else
					log = E('pre', { 'wrap': 'pre' }, [
						_('Unknown error: %s').format(e)
					]);

				dom.content(log_textarea, log);
			});
		}));

		function cacheLogEntries() {
			if (logEntriesCache) return logEntriesCache;
			
			var logContainer = document.getElementById('log_textarea');
			var entries = logContainer.querySelectorAll('.log-container');
			logEntriesCache = [];
			
			entries.forEach(function(entry) {
				logEntriesCache.push({
					element: entry,
					text: entry.textContent.toLowerCase(),
					originalHtml: entry.innerHTML
				});
			});
			
			return logEntriesCache;
		}

		function applyFilter(filter) {
			if (!filter) {
				var logContainer = document.getElementById('log_textarea');
				var preElem = logContainer.querySelector('pre');
				if (preElem) {
					preElem.innerHTML = originalLogContent || _('Log is empty.');
					logEntriesCache = null;
				}
				return;
			}

			filter = filter.toLowerCase();
			var entries = cacheLogEntries();
			var matchCount = 0;
			
			requestAnimationFrame(function() {
				entries.forEach(function(entry) {
					if (entry.text.includes(filter)) {
						matchCount++;
						entry.element.innerHTML = highlightFilter(entry.originalHtml, filter);
						entry.element.style.display = '';
					} else {
						entry.element.style.display = 'none';
					}
				});
			});
		}
		
		function clearLog() {
			return ui.showModal(_('Clear Log'), [
				E('p', {}, _('Are you sure you want to clear the log file?')),
				E('div', { class: 'right' }, [
					E('button', {
						'class': 'btn',
						'click': ui.hideModal
					}, _('Cancel')),
					E('button', {
						'class': 'cbi-button cbi-button-positive important',
						'click': function() {
							ui.hideModal();
							
							fs.write('/var/log/duck/duck.log', '')
							.then(function() {
								ui.addNotification(_('Success'), _('Log file has been cleared.'), 'success');
								
								var logContainer = document.getElementById('log_textarea');
								var preElem = logContainer.querySelector('pre');
								if (preElem) {
									preElem.innerHTML = _('Log file does not exist.');
									logEntriesCache = null;
									originalLogContent = '';
								}
							})
							.catch(function(error) {
								ui.addNotification(_('Error'), _('Failed to clear log file: %s').format(error), 'error');
							});
						}
					}, _('Clear'))
				])
			]);
		}

		var scrollDownButton = E('button', {
				'id': 'scrollDownButton',
				'class': 'cbi-button cbi-button-neutral',
			}, _('Scroll to tail', 'scroll to bottom (the tail) of the log file')
		);
		scrollDownButton.addEventListener('click', function() {
			var logContainer = document.getElementById('log_textarea');
			if (logContainer) {
				logContainer.scrollTop = logContainer.scrollHeight;
			}
		});

		var scrollUpButton = E('button', {
				'id' : 'scrollUpButton',
				'class': 'cbi-button cbi-button-neutral',
			}, _('Scroll to head', 'scroll to top (the head) of the log file')
		);
		scrollUpButton.addEventListener('click', function() {
			var logContainer = document.getElementById('log_textarea');
			if (logContainer) {
				logContainer.scrollTop = 0;
			}
		});
        
		var clearFilterButton = E('button', {
				'id': 'clearFilterButton',
				'class': 'cbi-button cbi-button-neutral',
			}, _('Clear Filter')
		);
		
		var clearLogButton = E('button', {
			'id': 'clearLogButton',
			'class': 'cbi-button cbi-button-negative',
		}, _('Clear Log'));
		
		clearLogButton.addEventListener('click', clearLog);
		
		var filterInput = E('input', {
			'id': 'filterInput',
			'type': 'text',
			'placeholder': _('Filter logs...'),
			'style': 'padding: 5px; border-radius: 4px; border: 1px solid #ddd; width: 200px;'
		});
		
		filterInput.addEventListener('input', debounce(function() {
			var filter = this.value;
			applyFilter(filter);
		}, 200));
		
		clearFilterButton.addEventListener('click', function() {
			var filterInput = document.getElementById('filterInput');
			if (filterInput) {
				filterInput.value = '';
				applyFilter('');
				logEntriesCache = null;
			}
		});

		return E([
			E('style', [ css ]),
			E('h2', {}, [ _('Log') ]),
			E('div', {'class': 'cbi-map'}, [
				E('div', {'class': 'controls-container'}, [
					E('div', {'class': 'controls-row'}, [
						filterInput,
						clearFilterButton
					]),
					E('div', {'class': 'controls-row'}, [
						scrollUpButton,
						scrollDownButton,
						clearLogButton
					])
				]),
				E('div', {'class': 'cbi-section'}, [
					log_textarea,
					E('div', {'style': 'text-align:right; margin-top: 5px;'},
						E('small', {}, _('Refresh every %s seconds.').format(L.env.pollinterval))
					)
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
