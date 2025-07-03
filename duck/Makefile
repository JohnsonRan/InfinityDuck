# SPDX-License-Identifier: GPL-2.0-only
#
# Copyright (C) 2023 ImmortalWrt.org

include $(TOPDIR)/rules.mk

PKG_NAME:=duck
PKG_VERSION:=2025.07.03
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/daeuniverse/dae.git
PKG_SOURCE_VERSION:=39cf60314c2b94f181c263a0b6c62dc241ce71e6
PKG_MIRROR_HASH:=skip

PKG_LICENSE:=AGPL-3.0-only
PKG_LICENSE_FILE:=LICENSE
PKG_MAINTAINER:=JohnsonRan <me@ihtw.moe>

PKG_BUILD_DEPENDS:=golang/host bpf-headers
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=no-mips16

GO_PKG:=github.com/daeuniverse/dae
GO_PKG_EXCLUDES:=control/kern/tests
GO_PKG_LDFLAGS_X:= \
	$(GO_PKG)/cmd.Version=$(PKG_VERSION) \
	$(GO_PKG)/common/consts.MaxMatchSetLen_=1024
GO_PKG_TAGS:=trace

include $(INCLUDE_DIR)/package.mk
include $(INCLUDE_DIR)/bpf.mk
include $(TOPDIR)/feeds/packages/lang/golang/golang-package.mk

UNZIP_CMD:=unzip -q -d $(PKG_BUILD_DIR) $(DL_DIR)/$(PKG_SOURCE)

define Package/duck/Default
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Web Servers/Proxies
  URL:=https://github.com/duckuniverse/dae
endef

define Package/duck
  $(call Package/duck/Default)
  TITLE:=A lightweight and high-performance transparent proxy solution
  # You need enable KERNEL_DEBUG_INFO_BTF and KERNEL_BPF_EVENTS
  DEPENDS:=$(GO_ARCH_DEPENDS) $(BPF_DEPENDS)  \
    +ca-bundle +kmod-sched-core +kmod-sched-bpf +kmod-xdp-sockets-diag \
    +kmod-veth
endef

define Package/duck-geoip
  $(call Package/duck/Default)
  TITLE:=geoip for duck
  DEPENDS:=+duck +v2ray-geoip
  PKGARCH:=all
endef

define Package/duck-geosite
  $(call Package/duck/Default)
  TITLE:=geosite for duck
  DEPENDS:=+duck +v2ray-geosite
  PKGARCH:=all
endef

define Package/duck/description
  dae, means goose, is a lightweight and high-performance transparent
  proxy solution.

  In order to improve the traffic diversion performance as much as possible,
  dae runs the transparent proxy and traffic diversion suite in the linux
  kernel by eBPF. Therefore, we have the opportunity to make the direct
  traffic bypass the forwarding by proxy application and achieve true direct
  traffic through. Under such a magic trick, there is almost no performance
  loss and additional resource consumption for direct traffic.
endef

define Package/duck/conffiles
/etc/duck/config.dae
/etc/config/duck
endef

duck_CFLAGS:= \
	-O2 -Wall -Werror \
	-DMAX_MATCH_SET_LEN=1024 \
	-I$(BPF_HEADERS_DIR)/tools/lib \
	-I$(BPF_HEADERS_DIR)/arch/$(BPF_KARCH)/include/asm/mach-generic

define Build/Compile
	( \
		export \
		$(GO_GENERAL_BUILD_CONFIG_VARS) \
		$(GO_PKG_BUILD_CONFIG_VARS) \
		$(GO_PKG_BUILD_VARS) \
		BPF_CLANG="$(CLANG)" \
		BPF_STRIP_FLAG="-strip=$(LLVM_STRIP)" \
		BPF_CFLAGS="$(duck_CFLAGS)" \
		BPF_TARGET="bpfel,bpfeb" \
		BPF_TRACE_TARGET="$(GO_ARCH)" ; \
		go generate $(PKG_BUILD_DIR)/control/control.go ; \
		go generate $(PKG_BUILD_DIR)/trace/trace.go ; \
		$(call GoPackage/Build/Compile) ; \
	)
endef

define Package/duck/install
	$(call GoPackage/Package/Install/Bin,$(1))

	$(INSTALL_DIR) $(1)/etc/duck/
	$(INSTALL_CONF) $(PKG_BUILD_DIR)/example.dae $(1)/etc/duck/

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) $(CURDIR)/files/duck.config $(1)/etc/config/duck

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) $(CURDIR)/files/duck.init $(1)/etc/init.d/duck
endef

define Package/duck-geoip/install
	$(INSTALL_DIR) $(1)/usr/share/dae
	$(LN) ../v2ray/geoip.dat $(1)/usr/share/dae/geoip.dat
endef

define Package/duck-geosite/install
	$(INSTALL_DIR) $(1)/usr/share/dae
	$(LN) ../v2ray/geosite.dat $(1)/usr/share/dae/geosite.dat
endef

$(eval $(call GoBinPackage,duck))
$(eval $(call BuildPackage,duck))
$(eval $(call BuildPackage,duck-geoip))
$(eval $(call BuildPackage,duck-geosite))
